import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
const servicePrefix = "/users";

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
const port = Number(process.env.PORT || 3001);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://user_admin:user_password@localhost:5433/users_db",
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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(180) UNIQUE NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'client',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'client', 'manager')),

      CONSTRAINT users_status_check
        CHECK (status IN ('active', 'inactive'))
    );
  `);

  console.log("Table users initialisée.");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "user-service",
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "user-service",
      database: "disconnected",
    });
  }
});

app.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/", async (req, res, next) => {
  const {
    full_name,
    email,
    role = "client",
    status = "active",
  } = req.body;

  if (!full_name?.trim() || !email?.trim()) {
    return res.status(400).json({
      message: "Le nom et l'adresse email sont obligatoires.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "L'adresse email n'est pas valide.",
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO users (
          full_name,
          email,
          role,
          status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        full_name.trim(),
        email.trim().toLowerCase(),
        role,
        status,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/:id", async (req, res, next) => {
  const { full_name, email, role, status } = req.body;

  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      message: "L'adresse email n'est pas valide.",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET
          full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          status = COALESCE($4, status),
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        full_name?.trim(),
        email?.trim().toLowerCase(),
        role,
        status,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.code === "23505") {
    return res.status(409).json({
      message: "Un utilisateur possède déjà cette adresse email.",
    });
  }

  if (error.code === "22P02") {
    return res.status(400).json({
      message: "L'identifiant fourni n'est pas valide.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "Le rôle ou le statut fourni n'est pas valide.",
    });
  }

  res.status(500).json({
    message: "Erreur interne du service utilisateur.",
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`User Service démarré sur le port ${port}`);
    });
  } catch (error) {
    console.error("Impossible de démarrer User Service :", error);
    process.exit(1);
  }
}

startServer();