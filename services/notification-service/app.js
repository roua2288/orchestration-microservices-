import express from "express";
import pg from "pg";
import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

const { Pool } = pg;

const app = express();
const servicePrefix = "/notifications";

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
const port = Number(process.env.PORT || 3005);

const awsRegion = process.env.AWS_REGION || "eu-west-3";
const senderEmail = process.env.SES_FROM_EMAIL || "";
const userServiceUrl =
  process.env.USER_SERVICE_URL || "http://localhost:3001";
const ses = new SESv2Client({ region: awsRegion });

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

async function resolveRecipient(userId, recipient) {
  if (recipient?.trim()) {
    return recipient.trim();
  }

  if (!userId) {
    throw new Error("L'utilisateur ou le destinataire est obligatoire.");
  }

  const response = await fetch(`${userServiceUrl}/${userId}`);

  if (!response.ok) {
    throw new Error("Impossible de récupérer l'adresse email de l'utilisateur.");
  }

  const user = await response.json();

  if (!user.email?.trim()) {
    throw new Error("L'utilisateur ne possède aucune adresse email.");
  }

  return user.email.trim();
}

async function sendEmail({ recipient, subject, message }) {
  if (!senderEmail) {
    throw new Error("SES_FROM_EMAIL n'est pas configuré.");
  }

  const html = `
    <!doctype html>
    <html lang="fr">
      <body style="margin:0;background:#f6f7ff;font-family:Arial,sans-serif;color:#171633">
        <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ebe9ff">
          <div style="padding:24px 30px;background:linear-gradient(135deg,#171633,#635bff);color:#ffffff">
            <div style="font-size:24px;font-weight:800">SUBUL</div>
            <div style="margin-top:5px;color:#ddd8ff">Formation IA, Certifications &amp; Emploi</div>
          </div>
          <div style="padding:30px">
            <h1 style="margin:0 0 16px;font-size:23px">${subject}</h1>
            <p style="margin:0;line-height:1.7;color:#4b5563">${message}</p>
            <div style="margin-top:26px;padding:14px 16px;border-radius:12px;background:#f6f7ff;color:#635bff;font-weight:700">
              Consultez votre espace SUBUL pour suivre votre parcours.
            </div>
          </div>
          <div style="padding:18px 30px;background:#fafaff;color:#7c8194;font-size:12px">
            Ceci est un message automatique envoyé par SUBUL.
          </div>
        </div>
      </body>
    </html>
  `;

  return ses.send(
    new SendEmailCommand({
      FromEmailAddress: senderEmail,
      Destination: {
        ToAddresses: [recipient],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: message,
              Charset: "UTF-8",
            },
            Html: {
              Data: html,
              Charset: "UTF-8",
            },
          },
        },
      },
    })
  );
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "notification-service",
      database: "connected",
      email: senderEmail ? "configured" : "not_configured",
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

  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({
      message: "Le sujet et le message sont obligatoires.",
    });
  }

  try {
    const resolvedRecipient = await resolveRecipient(user_id, recipient);
    const inserted = await pool.query(
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
        resolvedRecipient,
        channel,
        subject.trim(),
        message.trim(),
        "pending",
        null,
      ]
    );

    let deliveryStatus = "sent";
    let sentAt = new Date();

    try {
      await sendEmail({
        recipient: resolvedRecipient,
        subject: subject.trim(),
        message: message.trim(),
      });
    } catch (emailError) {
      deliveryStatus = "failed";
      sentAt = null;
      console.error("Envoi SES impossible :", emailError);
    }

    const updated = await pool.query(
      `
        UPDATE notifications
        SET status = $1, sent_at = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [deliveryStatus, sentAt, inserted.rows[0].id]
    );

    res.status(201).json(updated.rows[0]);
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
