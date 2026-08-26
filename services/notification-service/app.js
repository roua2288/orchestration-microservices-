import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT || 3005);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://notification_admin:notification_password@localhost:5437/notifications_db",
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
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      recipient VARCHAR(180) NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'email',
      subject VARCHAR(180) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT notifications_channel_check CHECK (
        channel IN ('email', 'sms', 'push')
      ),

      CONSTRAINT notifications_status_check CHECK (
        status IN ('pending', 'sent', 'failed', 'read')
      )
    );
  `);

  console.log("Table notifications initialisée.");
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "notification-service",
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "notification-service",
      database: "disconnected",
    });
  }
});

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM notifications
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
      "SELECT * FROM notifications WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notification introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/", async (req, res, next) => {
  const {
    user_id = null,
    recipient,
    channel = "email",
    subject,
    message,
    status = "pending",
  } = req.body;

  if (!recipient?.trim() || !subject?.trim() || !message?.trim()) {
    return res.status(400).json({
      message:
        "Le destinataire, le sujet et le message sont obligatoires.",
    });
  }

  const sentAt = status === "sent" ? new Date() : null;

  try {
    const result = await pool.query(
      `
        INSERT INTO notifications (
          user_id,
          recipient,
          channel,
          subject,
          message,
          status,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        user_id,
        recipient.trim(),
        channel,
        subject.trim(),
        message.trim(),
        status,
        sentAt,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/:id", async (req, res, next) => {
  const {
    recipient,
    channel,
    subject,
    message,
    status,
  } = req.body;

  try {
    const currentNotification = await pool.query(
      "SELECT * FROM notifications WHERE id = $1",
      [req.params.id]
    );

    if (currentNotification.rowCount === 0) {
      return res.status(404).json({
        message: "Notification introuvable.",
      });
    }

    const current = currentNotification.rows[0];
    const nextStatus = status || current.status;

    const sentAt =
      nextStatus === "sent"
        ? current.sent_at || new Date()
        : current.sent_at;

    const result = await pool.query(
      `
        UPDATE notifications
        SET
          recipient = COALESCE($1, recipient),
          channel = COALESCE($2, channel),
          subject = COALESCE($3, subject),
          message = COALESCE($4, message),
          status = COALESCE($5, status),
          sent_at = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [
        recipient?.trim(),
        channel,
        subject?.trim(),
        message?.trim(),
        status,
        sentAt,
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
      "DELETE FROM notifications WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notification introuvable.",
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.code === "22P02") {
    return res.status(400).json({
      message: "Un identifiant ou une valeur n'est pas valide.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "Les données de la notification ne sont pas valides.",
    });
  }

  res.status(500).json({
    message: "Erreur interne du service notification.",
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Notification Service démarré sur le port ${port}`);
    });
  } catch (error) {
    console.error(
      "Impossible de démarrer Notification Service :",
      error
    );

    process.exit(1);
  }
}

startServer();