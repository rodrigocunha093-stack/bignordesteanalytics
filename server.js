const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 8080;
const databaseUrl = process.env.DATABASE_URL;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

let pool = null;

function getPool() {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

app.get("/api/health", async (_req, res) => {
  try {
    const db = getPool();
    if (!db) return res.json({ ok: true, database: "not_configured" });
    await ensureSchema();
    await db.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchema();
    const result = await db.query("SELECT data FROM app_state WHERE id = $1", ["main"]);
    res.json(result.rows[0]?.data || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchema();
    await db.query(
      `
      INSERT INTO app_state (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `,
      ["main", JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, async () => {
  try {
    await ensureSchema();
    console.log(`BIGNORDESTE ANALYTICS rodando em http://127.0.0.1:${port}`);
    console.log(databaseUrl ? "Banco PostgreSQL configurado." : "DATABASE_URL nao configurada; API de banco desativada.");
  } catch (error) {
    console.error("Erro ao preparar banco:", error.message);
  }
});
