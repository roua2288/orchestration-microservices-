import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
const servicePrefix = "/orders";

app.use((req, res, next) => {
  const matchesPrefix =
    req.url === servicePrefix ||
    req.url.startsWith(servicePrefix + "/") ||
    req.url.startsWith(servicePrefix + "?");

  if (matchesPrefix) {
    const rewrittenUrl = req.url.slice(servicePrefix.length);

    req.url =
      rewrittenUrl === ""
        ? "/"
        : rewrittenUrl.startsWith("?")
          ? "/" + rewrittenUrl
          : rewrittenUrl;
  }

  next();
});
const port = Number(process.env.PORT || 3003);

const productServiceUrl =
  process.env.PRODUCT_SERVICE_URL ||
  "http://localhost:3002";

const notificationServiceUrl =
  process.env.NOTIFICATION_SERVICE_URL ||
  "http://localhost:3005";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://order_admin:order_password@localhost:5435/orders_db",
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
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reference VARCHAR(40) UNIQUE NOT NULL,
      user_id UUID NOT NULL,
      product_id UUID NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS unit_price
        NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  console.log("Table orders initialisée.");
}

function createReference() {
  const timestamp = Date.now().toString().slice(-8);
  const randomNumber = Math.floor(100 + Math.random() * 900);

  return `CMD-${timestamp}-${randomNumber}`;
}

async function getFormation(productId) {
  const response = await fetch(
    `${productServiceUrl}/${productId}`
  );

  if (response.status === 404) {
    const error = new Error("Formation introuvable.");
    error.statusCode = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      "Impossible de récupérer le prix de la formation."
    );

    error.statusCode = 502;
    throw error;
  }

  const formation = await response.json();

  if (formation.status !== "active") {
    const error = new Error(
      "Cette formation n'est pas disponible."
    );

    error.statusCode = 400;
    throw error;
  }

  return formation;
}

async function notifyUser(payload) {
  try {
    const response = await fetch(notificationServiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Notification refusée :", await response.text());
    }
  } catch (error) {
    console.error("Notification indisponible :", error.message);
  }
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "order-service",
      database: "connected",
      product_service: productServiceUrl,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "order-service",
      database: "disconnected",
    });
  }
});

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM orders
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
      "SELECT * FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Commande introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/", async (req, res, next) => {
  const {
    user_id,
    product_id,
    quantity = 1,
    status = "pending",
  } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({
      message:
        "L'utilisateur et la formation sont obligatoires.",
    });
  }

  if (Number(quantity) <= 0) {
    return res.status(400).json({
      message: "La quantité doit être supérieure à zéro.",
    });
  }

  try {
    const formation = await getFormation(product_id);
    const unitPrice = Number(formation.price);
    const totalAmount = unitPrice * Number(quantity);

    const result = await pool.query(
      `
        INSERT INTO orders (
          reference,
          user_id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        createReference(),
        user_id,
        product_id,
        quantity,
        unitPrice,
        totalAmount,
        status,
      ]
    );

    const createdOrder = result.rows[0];

    await notifyUser({
      user_id: createdOrder.user_id,
      channel: "email",
      subject: "Commande SUBUL enregistrée",
      message: `Votre inscription à la formation ${formation.name} a été enregistrée. Référence : ${createdOrder.reference}. Montant : ${Number(createdOrder.total_amount).toFixed(2)} TND.`,
    });

    res.status(201).json({
      ...createdOrder,
      formation_name: formation.name,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/:id", async (req, res, next) => {
  const {
    user_id,
    product_id,
    quantity,
    status,
  } = req.body;

  try {
    const currentResult = await pool.query(
      "SELECT * FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({
        message: "Commande introuvable.",
      });
    }

    const currentOrder = currentResult.rows[0];

    const nextProductId =
      product_id || currentOrder.product_id;

    const nextQuantity =
      quantity === undefined
        ? currentOrder.quantity
        : Number(quantity);

    if (nextQuantity <= 0) {
      return res.status(400).json({
        message: "La quantité doit être supérieure à zéro.",
      });
    }

    const formation = await getFormation(nextProductId);
    const unitPrice = Number(formation.price);
    const totalAmount = unitPrice * nextQuantity;

    const result = await pool.query(
      `
        UPDATE orders
        SET
          user_id = COALESCE($1, user_id),
          product_id = $2,
          quantity = $3,
          unit_price = $4,
          total_amount = $5,
          status = COALESCE($6, status),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [
        user_id,
        nextProductId,
        nextQuantity,
        unitPrice,
        totalAmount,
        status,
        req.params.id,
      ]
    );

    res.json({
      ...result.rows[0],
      formation_name: formation.name,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Commande introuvable.",
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

  if (error.code === "22P02") {
    return res.status(400).json({
      message: "Un identifiant n'est pas valide.",
    });
  }

  res.status(500).json({
    message: "Erreur interne du service commande.",
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Order Service démarré sur le port ${port}`);
    });
  } catch (error) {
    console.error("Impossible de démarrer Order Service :", error);
    process.exit(1);
  }
}

startServer();
