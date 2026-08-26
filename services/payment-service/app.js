import express from "express";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT || 3004);

const orderServiceUrl =
  process.env.ORDER_SERVICE_URL ||
  "http://localhost:3003";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://payment_admin:payment_password@localhost:5436/payments_db",
});

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.CORS_ORIGIN || "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_reference VARCHAR(60) UNIQUE NOT NULL,
      order_id UUID NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'card',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      payments_order_id_unique
    ON payments(order_id);
  `);

  console.log("Table payments initialisée.");
}

function createTransactionReference() {
  return `PAY-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

async function getOrder(orderId) {
  const response = await fetch(
    `${orderServiceUrl}/${orderId}`
  );

  if (response.status === 404) {
    const error = new Error("Commande introuvable.");
    error.statusCode = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      "Impossible de récupérer le montant de la commande."
    );

    error.statusCode = 502;
    throw error;
  }

  const order = await response.json();

  if (order.status === "cancelled") {
    const error = new Error(
      "Une commande annulée ne peut pas être payée."
    );

    error.statusCode = 400;
    throw error;
  }

  return order;
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "payment-service",
      database: "connected",
      order_service: orderServiceUrl,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "payment-service",
      database: "disconnected",
    });
  }
});

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM payments
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Paiement introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/", async (req, res, next) => {
  const {
    order_id,
    payment_method = "card",
    status = "pending",
  } = req.body;

  if (!order_id) {
    return res.status(400).json({
      message: "La commande est obligatoire.",
    });
  }

  try {
    const order = await getOrder(order_id);
    const amount = Number(order.total_amount);

    const paidAt =
      status === "completed" ? new Date() : null;

    const result = await pool.query(
      `
        INSERT INTO payments (
          transaction_reference,
          order_id,
          amount,
          payment_method,
          status,
          paid_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        createTransactionReference(),
        order_id,
        amount,
        payment_method,
        status,
        paidAt,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      order_reference: order.reference,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/:id", async (req, res, next) => {
  const { payment_method, status } = req.body;

  try {
    const currentResult = await pool.query(
      "SELECT * FROM payments WHERE id = $1",
      [req.params.id]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({
        message: "Paiement introuvable.",
      });
    }

    const currentPayment = currentResult.rows[0];
    const order = await getOrder(currentPayment.order_id);
    const amount = Number(order.total_amount);

    const nextStatus = status || currentPayment.status;

    const paidAt =
      nextStatus === "completed"
        ? currentPayment.paid_at || new Date()
        : null;

    const result = await pool.query(
      `
        UPDATE payments
        SET
          amount = $1,
          payment_method = COALESCE($2, payment_method),
          status = COALESCE($3, status),
          paid_at = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        amount,
        payment_method,
        status,
        paidAt,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM payments WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Paiement introuvable.",
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  if (
    error.code === "23505" &&
    error.constraint === "payments_order_id_unique"
  ) {
    return res.status(409).json({
      message: "Cette commande possède déjà un paiement.",
    });
  }

  if (error.code === "22P02") {
    return res.status(400).json({
      message: "Un identifiant n'est pas valide.",
    });
  }

  res.status(500).json({
    message: "Erreur interne du service paiement.",
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Payment Service démarré sur le port ${port}`);
    });
  } catch (error) {
    console.error("Impossible de démarrer Payment Service :", error);
    process.exit(1);
  }
}

startServer();