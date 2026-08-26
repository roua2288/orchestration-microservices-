import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT || 3002);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://product_admin:product_password@localhost:5434/products_db",
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
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(180) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      provider VARCHAR(80) NOT NULL DEFAULT 'AWS',
      category VARCHAR(80) NOT NULL DEFAULT 'Cloud',
      level VARCHAR(30) NOT NULL DEFAULT 'Débutant',
      duration_hours INTEGER NOT NULL DEFAULT 1,
      certification VARCHAR(180) NOT NULL DEFAULT '',
      price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS provider
        VARCHAR(80) NOT NULL DEFAULT 'AWS',
      ADD COLUMN IF NOT EXISTS level
        VARCHAR(30) NOT NULL DEFAULT 'Débutant',
      ADD COLUMN IF NOT EXISTS duration_hours
        INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS certification
        VARCHAR(180) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS image_url
        TEXT NOT NULL DEFAULT '';
  `);

  await pool.query(`
    INSERT INTO products (
      name,
      description,
      provider,
      category,
      level,
      duration_hours,
      certification,
      price,
      stock,
      image_url,
      status
    )
    SELECT
      'AWS Solutions Architect Associate',
      'Formation complète sur la conception de solutions sécurisées, résilientes et performantes sur AWS.',
      'AWS',
      'Cloud Computing',
      'Intermédiaire',
      40,
      'AWS Certified Solutions Architect - Associate',
      450,
      0,
      'https://d1.awsstatic.com/training-and-certification/certification-badges/AWS-Certified-Solutions-Architect-Associate_badge.2f7b3c7f.png',
      'active'
    WHERE NOT EXISTS (
      SELECT 1
      FROM products
      WHERE name = 'AWS Solutions Architect Associate'
    );
  `);

  await pool.query(`
    INSERT INTO products (
      name,
      description,
      provider,
      category,
      level,
      duration_hours,
      certification,
      price,
      stock,
      image_url,
      status
    )
    SELECT
      'AWS Cloud Practitioner',
      'Introduction aux services AWS, à la sécurité, à la facturation et aux principes fondamentaux du Cloud.',
      'AWS',
      'Cloud Computing',
      'Débutant',
      20,
      'AWS Certified Cloud Practitioner',
      250,
      0,
      'https://d1.awsstatic.com/training-and-certification/certification-badges/AWS-Certified-Cloud-Practitioner_badge.9e94d7e0.png',
      'active'
    WHERE NOT EXISTS (
      SELECT 1
      FROM products
      WHERE name = 'AWS Cloud Practitioner'
    );
  `);

  await pool.query(`
    INSERT INTO products (
      name,
      description,
      provider,
      category,
      level,
      duration_hours,
      certification,
      price,
      stock,
      image_url,
      status
    )
    SELECT
      'Microsoft Azure Fundamentals',
      'Formation sur les concepts Cloud et les principaux services Microsoft Azure.',
      'Microsoft',
      'Cloud Computing',
      'Débutant',
      24,
      'Microsoft Certified: Azure Fundamentals AZ-900',
      280,
      0,
      'https://learn.microsoft.com/media/learn/certification/badges/microsoft-certified-fundamentals-badge.svg',
      'active'
    WHERE NOT EXISTS (
      SELECT 1
      FROM products
      WHERE name = 'Microsoft Azure Fundamentals'
    );
  `);

  await pool.query(`
    INSERT INTO products (
      name,
      description,
      provider,
      category,
      level,
      duration_hours,
      certification,
      price,
      stock,
      image_url,
      status
    )
    SELECT
      'Microsoft Azure Administrator',
      'Administration des identités, réseaux, machines virtuelles et ressources Azure.',
      'Microsoft',
      'Administration Cloud',
      'Intermédiaire',
      45,
      'Microsoft Certified: Azure Administrator Associate AZ-104',
      520,
      0,
      'https://learn.microsoft.com/media/learn/certification/badges/microsoft-certified-associate-badge.svg',
      'active'
    WHERE NOT EXISTS (
      SELECT 1
      FROM products
      WHERE name = 'Microsoft Azure Administrator'
    );
  `);

  console.log("Table des formations initialisée.");
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      service: "product-service",
      domain: "formations",
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: "product-service",
      database: "disconnected",
    });
  }
});

app.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        provider,
        category,
        level,
        duration_hours,
        certification,
        price,
        image_url,
        status,
        created_at,
        updated_at
      FROM products
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
      `
        SELECT
          id,
          name,
          description,
          provider,
          category,
          level,
          duration_hours,
          certification,
          price,
          image_url,
          status,
          created_at,
          updated_at
        FROM products
        WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Formation introuvable.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/", async (req, res, next) => {
  const {
    name,
    description = "",
    provider,
    category,
    level,
    duration_hours,
    certification = "",
    price,
    image_url = "",
    status = "active",
  } = req.body;

  if (
    !name?.trim() ||
    !provider?.trim() ||
    !category?.trim() ||
    !level?.trim() ||
    duration_hours === undefined ||
    price === undefined
  ) {
    return res.status(400).json({
      message: "Les informations obligatoires sont manquantes.",
    });
  }

  if (Number(duration_hours) <= 0 || Number(price) < 0) {
    return res.status(400).json({
      message: "La durée ou le prix n'est pas valide.",
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO products (
          name,
          description,
          provider,
          category,
          level,
          duration_hours,
          certification,
          price,
          stock,
          image_url,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)
        RETURNING *
      `,
      [
        name.trim(),
        description.trim(),
        provider.trim(),
        category.trim(),
        level,
        duration_hours,
        certification.trim(),
        price,
        image_url.trim(),
        status,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/:id", async (req, res, next) => {
  const {
    name,
    description,
    provider,
    category,
    level,
    duration_hours,
    certification,
    price,
    image_url,
    status,
  } = req.body;

  try {
    const result = await pool.query(
      `
        UPDATE products
        SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          provider = COALESCE($3, provider),
          category = COALESCE($4, category),
          level = COALESCE($5, level),
          duration_hours = COALESCE($6, duration_hours),
          certification = COALESCE($7, certification),
          price = COALESCE($8, price),
          image_url = COALESCE($9, image_url),
          status = COALESCE($10, status),
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `,
      [
        name?.trim(),
        description?.trim(),
        provider?.trim(),
        category?.trim(),
        level,
        duration_hours,
        certification?.trim(),
        price,
        image_url?.trim(),
        status,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Formation introuvable.",
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
      "DELETE FROM products WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Formation introuvable.",
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
      message: "Une valeur fournie n'est pas valide.",
    });
  }

  res.status(500).json({
    message: "Erreur interne du service formation.",
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Product Service démarré sur le port ${port}`);
    });
  } catch (error) {
    console.error("Impossible de démarrer Product Service :", error);
    process.exit(1);
  }
}

startServer();