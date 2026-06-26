const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

const app = express();
const port = process.env.PORT || 8080;
const databaseUrl = process.env.DATABASE_URL;
const apiToken = process.env.API_TOKEN || "";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});
app.use(express.static(__dirname));

function authRequired(req, res, next) {
  if (!apiToken) return next();
  const header = req.headers.authorization || "";
  if (header === `Bearer ${apiToken}`) return next();
  res.status(401).json({ error: "Token invalido ou ausente" });
}

let pool = null;

const bucketsByType = {
  resumo_geral_loja: "resumos",
  campanhas_ofertas: "campanhas",
  produtos_campanha: "produtos",
  departamentos_campanha: "departamentos",
  cupons_totais: "cupons",
  ofertas_dia_campanha: "ofertasDia",
  venda_diaria_loja: "vendasDiarias"
};

const dailyTypes = new Set(["ofertas_dia_campanha", "venda_diaria_loja"]);

function normalizeState(data) {
  const state = data && typeof data === "object" ? data : {};
  ["resumos", "campanhas", "departamentos", "produtos", "cupons", "importacoes", "ofertasDia", "vendasDiarias"].forEach((key) => {
    if (!Array.isArray(state[key])) state[key] = [];
  });
  if (!state.aprovacoes || typeof state.aprovacoes !== "object") state.aprovacoes = {};
  if (!Array.isArray(state.empresas)) state.empresas = [];
  return state;
}

function monthKey(value) {
  return String(value || "").slice(0, 7);
}

function dateKey(value) {
  return String(value || "").slice(0, 10);
}

function inDatePeriod(value, start, end) {
  const key = dateKey(value);
  return key && key >= start && key < end;
}

function monthsBetween(start, end) {
  const out = [];
  const current = new Date(`${start.slice(0, 7)}-01T00:00:00`);
  const limit = new Date(`${end.slice(0, 7)}-01T00:00:00`);
  while (current < limit) {
    out.push(String(current.getFullYear()) + "-" + String(current.getMonth() + 1).padStart(2, "0"));
    current.setMonth(current.getMonth() + 1);
  }
  return out;
}

function periodKey(loja) {
  return loja;
}

function getPool() {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX || 2),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || 5000),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || 10000),
      allowExitOnIdle: true
    });
    pool.on("error", (error) => {
      console.error("Erro no pool PostgreSQL:", error.message);
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
    await db.query("SELECT 1");
    res.json({
      ok: true,
      database: "connected",
      pool: {
        total: db.totalCount,
        idle: db.idleCount,
        waiting: db.waitingCount
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", authRequired, async (_req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    const result = await db.query("SELECT data FROM app_state WHERE id = $1", ["main"]);
    res.json(result.rows[0]?.data || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/state", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT 1 FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(req.body)]
      );
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/import-batch", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    const { loja, ini, fim, hasMonthly, groups = [], hist = [] } = req.body || {};
    if (!loja || !ini || !fim || !Array.isArray(groups)) {
      return res.status(400).json({ error: "Payload de importacao invalido" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      const state = normalizeState(result.rows[0]?.data || {});
      const allowedMonths = monthsBetween(ini, fim);

      if (hasMonthly) delete state.aprovacoes[periodKey(loja)];

      for (const group of groups) {
        const tipo = group.tipo;
        const bucket = bucketsByType[tipo];
        if (!bucket) continue;
        const diario = dailyTypes.has(tipo);
        const rows = Array.isArray(group.rows) ? group.rows : [];
        state[bucket] = state[bucket]
          .filter((row) => !(row.loja == loja && row.__tipo == tipo && (diario ? inDatePeriod(row.data, ini, fim) : allowedMonths.includes(monthKey(row.mes)))))
          .concat(rows);
      }

      if (hist.length) state.importacoes.unshift(...hist);

      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(state)]
      );
      await client.query("COMMIT");

      res.json({
        ok: true,
        rows: groups.reduce((sum, group) => sum + (Array.isArray(group.rows) ? group.rows.length : 0), 0),
        ofertasDia: state.ofertasDia.length,
        vendasDiarias: state.vendasDiarias.length
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.all("/api/*", (_req, res) => {
  res.status(404).json({ error: "Endpoint nao encontrado" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (require.main === module) {
  app.listen(port, async () => {
    try {
      await ensureSchema();
      console.log(`BIGNORDESTE ANALYTICS rodando em http://127.0.0.1:${port}`);
      console.log(databaseUrl ? "Banco PostgreSQL configurado." : "DATABASE_URL nao configurada; API de banco desativada.");
      console.log(apiToken ? "API protegida por token." : "AVISO: API_TOKEN nao configurado, API sem autenticacao.");
    } catch (error) {
      console.error("Erro ao preparar banco:", error.message);
    }
  });
}

module.exports = app;
