import express from "express";
import client from "prom-client";

const app = express();
const port = process.env.PORT || 80;

const userServiceUrl =
  process.env.USER_SERVICE_URL ||
  "http://orchestration-app-user-service";

app.use(express.json());

client.collectDefaultMetrics();

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Nombre total de requetes HTTP",
  labelNames: ["method", "route", "status_code"]
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duree des requetes HTTP en secondes",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;

    const route = req.route?.path || req.path || "unknown";

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode
      },
      durationSeconds
    );

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "backend",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durationSeconds * 1000)
    }));
  });

  next();
});

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

app.get("/", (req, res) => {
  res.json({
    service: "backend",
    status: "running",
    message: "Backend API opérationnel"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy"
  });
});

app.get("/user", async (req, res) => {
  try {
    const response = await fetch(userServiceUrl);

    if (!response.ok) {
      return res.status(502).json({
        service: "backend",
        error: "Le user-service a retourné une erreur",
        status: response.status
      });
    }

    const contentType = response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    res.json({
      service: "backend",
      dependency: "user-service",
      dependencyUrl: userServiceUrl,
      result: data
    });

  } catch (error) {
    res.status(503).json({
      service: "backend",
      error: "Impossible de contacter le user-service",
      details: error.message
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend API démarré sur le port ${port}`);
  console.log(`User Service URL : ${userServiceUrl}`);
});