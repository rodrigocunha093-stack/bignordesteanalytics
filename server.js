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
  venda_departamento_total: "deptTotais",
  ofertas_dia_campanha: "ofertasDia",
  venda_diaria_loja: "vendasDiarias"
};

const dailyTypes = new Set(["ofertas_dia_campanha", "venda_diaria_loja"]);

function normalizeState(data) {
  const state = data && typeof data === "object" ? data : {};
  ["resumos", "campanhas", "departamentos", "produtos", "cupons", "importacoes", "ofertasDia", "vendasDiarias", "deptTotais"].forEach((key) => {
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state_backup (
      id BIGSERIAL PRIMARY KEY,
      state_id TEXT NOT NULL,
      data JSONB NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_app_state_backup_state ON app_state_backup (state_id, created_at DESC);`);
}

// Em serverless (Vercel) o bloco require.main nao roda, entao garantimos o schema
// uma vez por instancia (cold start), de forma idempotente, antes de cada escrita.
let schemaReady = null;
function ensureSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

const GUARDED_BUCKETS = ["empresas", "resumos", "campanhas", "departamentos", "produtos", "cupons", "ofertasDia", "vendasDiarias", "deptTotais"];
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP || 30);

function bucketCounts(state) {
  const out = {};
  for (const key of GUARDED_BUCKETS) out[key] = Array.isArray(state && state[key]) ? state[key].length : 0;
  return out;
}

// Detecta buckets que ENCOLHERIAM (perda de dados). Edicoes legitimas nunca reduzem volume;
// importacoes usam /api/import-batch (merge). Logo, qualquer reducao via PUT e um clobber.
function detectShrink(prev, incoming) {
  if (!prev) return [];
  return GUARDED_BUCKETS
    .map((bucket) => ({ bucket, from: (prev[bucket] || []).length, to: (incoming[bucket] || []).length }))
    .filter((x) => x.to < x.from);
}

async function backupState(client, prevData, reason) {
  if (!prevData) return;
  // Backup e seguro secundario: nunca deve quebrar a escrita principal (merge/PUT).
  try {
    await client.query(
      "INSERT INTO app_state_backup (state_id, data, reason) VALUES ($1, $2::jsonb, $3)",
      ["main", JSON.stringify(prevData), reason || ""]
    );
    await client.query(
      `DELETE FROM app_state_backup WHERE id IN (
         SELECT id FROM app_state_backup WHERE state_id = $1 ORDER BY created_at DESC OFFSET $2
       )`,
      ["main", BACKUP_KEEP]
    );
  } catch (error) {
    console.error("Falha ao gravar backup (escrita principal continua):", error.message);
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    const db = getPool();
    if (!db) return res.json({ ok: true, database: "not_configured", protected: Boolean(apiToken) });
    await db.query("SELECT 1");
    res.json({
      ok: true,
      database: "connected",
      protected: Boolean(apiToken),
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
    if (!db) {
      console.log("DATABASE_URL nao configurada, usando localStorage fallback");
      return res.json(null);
    }
    try {
      await ensureSchemaOnce();
      const result = await db.query("SELECT data FROM app_state WHERE id = $1", ["main"]);
      res.json(result.rows[0]?.data || null);
    } catch (dbError) {
      console.log("Erro ao conectar banco, usando localStorage fallback:", dbError.message);
      res.json(null);
    }
  } catch (error) {
    console.error("Erro em /api/state:", error.message);
    res.json(null);
  }
});

app.get("/api/audit/unclassified-products", authRequired, async (_req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchemaOnce();
    const result = await db.query(`
      SELECT
        DISTINCT COALESCE(NULLIF(BTRIM(product->>'descricao_produto'), ''), '[VAZIO]') AS descricao
      FROM app_state state
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(state.data->'produtos', '[]'::jsonb)) product
      WHERE state.id = $1
        AND UPPER(BTRIM(COALESCE(product->>'descricao_departamento', ''))) IN
          ('', 'OUTROS', 'A ACERTAR', 'SEM DEPARTAMENTO', 'NAO DEFINIDO', 'INDEFINIDO', 'SEM CLASSIFICACAO')
      ORDER BY 1
    `, ["main"]);
    res.json({ produtos: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/state", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchemaOnce();
    // Fail-safe: o bypass "force" so e honrado quando ha API_TOKEN configurado (e portanto
    // a requisicao passou pela autenticacao). Sem token, o guarda anti-encolhimento e SEMPRE
    // aplicado, para que ninguem anonimo consiga apagar a base.
    const force = Boolean(apiToken) && (req.query.force === "1" || req.headers["x-force-write"] === "1");
    const incoming = normalizeState(req.body);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      const prev = current.rows[0]?.data || null;
      const shrunk = detectShrink(prev, incoming);
      if (shrunk.length && !force) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Gravacao bloqueada: reduziria dados existentes",
          shrunk,
          counts: bucketCounts(prev)
        });
      }
      await backupState(client, prev, "put");
      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(incoming)]
      );
      await client.query("COMMIT");
      res.json({ ok: true, counts: bucketCounts(incoming) });
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
    await ensureSchemaOnce();

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      const prevState = result.rows[0]?.data || null;
      await backupState(client, prevState, "import:" + loja);
      const state = normalizeState(prevState || {});
      const allowedMonths = monthsBetween(ini, fim);

      if (hasMonthly) delete state.aprovacoes[periodKey(loja)];

      for (const group of groups) {
        const tipo = group.tipo;
        const bucket = bucketsByType[tipo];
        if (!bucket) continue;
        const diario = dailyTypes.has(tipo);
        const rows = Array.isArray(group.rows) ? group.rows : [];
        const before = state[bucket].length;
        const filtered = state[bucket]
          .filter((row) => !(row.loja == loja && row.__tipo == tipo && (diario ? inDatePeriod(row.data, ini, fim) : allowedMonths.includes(monthKey(row.mes)))));
        const deleted = before - filtered.length;
        if (deleted > 0 && rows.length === 0) {
          throw new Error(`Seguranca: tentativa de deletar ${deleted} rows do bucket ${bucket} SEM adicionar dados novos para ${loja}/${tipo}. Isso indica um problema na importacao.`);
        }
        state[bucket] = filtered.concat(rows);
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

app.get("/api/backups", authRequired, async (_req, res) => {
  try {
    const db = getPool();
    if (!db) {
      console.log("DATABASE_URL nao configurada, retornando backups vazio");
      return res.json([]);
    }
    try {
      await ensureSchemaOnce();
      const result = await db.query(
        "SELECT id, reason, created_at, data FROM app_state_backup WHERE state_id = $1 ORDER BY created_at DESC LIMIT $2",
        ["main", BACKUP_KEEP]
      );
      res.json(result.rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        created_at: row.created_at,
        counts: bucketCounts(row.data)
      })));
    } catch (dbError) {
      console.log("Erro ao carregar backups, retornando vazio:", dbError.message);
      res.json([]);
    }
  } catch (error) {
    console.error("Erro em /api/backups:", error.message);
    res.json([]);
  }
});

app.post("/api/restore/:id", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    // Restauracao substitui o estado inteiro (operacao destrutiva que ignora o guarda).
    // So permitida quando a API esta protegida por token, para nao ficar exposta a anonimos.
    if (!apiToken) return res.status(403).json({ error: "Restauracao desabilitada: configure API_TOKEN para habilitar" });
    await ensureSchemaOnce();
    const backupId = req.params.id;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const backup = await client.query("SELECT data FROM app_state_backup WHERE id = $1 AND state_id = $2", [backupId, "main"]);
      if (!backup.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Backup nao encontrado" });
      }
      const restoreData = backup.rows[0].data;
      const current = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      await backupState(client, current.rows[0]?.data || null, "pre-restore");
      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(restoreData)]
      );
      await client.query("COMMIT");
      res.json({ ok: true, restored: backupId, counts: bucketCounts(restoreData) });
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

app.patch("/api/empresas", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchemaOnce();
    const { empresas, regioes, renames } = req.body || {};
    if (!Array.isArray(empresas)) return res.status(400).json({ error: "empresas deve ser um array" });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      const prev = result.rows[0]?.data || null;
      await backupState(client, prev, "patch-empresas");
      const state = normalizeState(prev || {});

      if (Array.isArray(renames)) {
        for (const { from, to } of renames) {
          if (!from || !to || from === to) continue;
          ["resumos", "campanhas", "departamentos", "produtos", "cupons", "ofertasDia", "vendasDiarias", "deptTotais"].forEach((bucket) => {
            (state[bucket] || []).forEach((row) => { if (row.loja === from) row.loja = to; });
          });
          (state.importacoes || []).forEach((row) => { if (row.loja === from) row.loja = to; });
          const newAprov = {};
          Object.entries(state.aprovacoes || {}).forEach(([key, val]) => {
            const parts = key.split("|");
            if (parts[0] === from) parts[0] = to;
            newAprov[parts.join("|")] = val;
          });
          state.aprovacoes = newAprov;
        }
      }

      state.empresas = empresas;
      if (Array.isArray(regioes)) state.regioes = regioes;

      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(state)]
      );
      await client.query("COMMIT");
      res.json({ ok: true, counts: bucketCounts(state) });
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

app.patch("/api/aprovacoes", authRequired, async (req, res) => {
  try {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "DATABASE_URL nao configurada" });
    await ensureSchemaOnce();
    const { updates } = req.body || {};
    if (!updates || typeof updates !== "object") return res.status(400).json({ error: "updates deve ser um objeto" });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", ["main"]);
      const prev = result.rows[0]?.data || null;
      await backupState(client, prev, "patch-aprovacoes");
      const state = normalizeState(prev || {});

      if (!state.aprovacoes) state.aprovacoes = {};
      Object.entries(updates).forEach(([key, val]) => { state.aprovacoes[key] = val; });

      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["main", JSON.stringify(state)]
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
