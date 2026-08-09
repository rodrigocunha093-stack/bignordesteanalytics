const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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
const apiToken = process.env.API_TOKEN || "";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const dbConfigured = Boolean(supabaseUrl && supabaseKey);

async function sbRest(table, { select, filter, order, limit, method = "GET", body, prefer, single } = {}) {
  let url = `${supabaseUrl}/rest/v1/${table}`;
  const params = [];
  if (select) params.push(`select=${encodeURIComponent(select)}`);
  if (filter) for (const [k, v] of Object.entries(filter)) params.push(`${k}=${encodeURIComponent(v)}`);
  if (order) params.push(`order=${encodeURIComponent(order)}`);
  if (limit) params.push(`limit=${limit}`);
  if (params.length) url += "?" + params.join("&");

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers["Prefer"] = prefer;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${errText}`);
  }
  const text = await res.text();
  if (!text) return single ? null : [];
  const data = JSON.parse(text);
  return single ? (Array.isArray(data) ? data[0] || null : data) : data;
}

async function sbGetState() {
  const row = await sbRest("app_state", { filter: { id: "eq.main" }, select: "data", single: true });
  return row ? row.data : null;
}

async function sbUpsertState(state) {
  await sbRest("app_state", {
    method: "PATCH",
    filter: { id: "eq.main" },
    body: { data: state, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

async function sbBackup(prevData, reason) {
  if (!prevData) return;
  try {
    await sbRest("app_state_backup", {
      method: "POST",
      body: { state_id: "main", data: prevData, reason: reason || "" },
      prefer: "return=minimal",
    });
    const old = await sbRest("app_state_backup", {
      filter: { state_id: "eq.main" },
      select: "id",
      order: "created_at.desc",
      limit: 1000,
    });
    if (old.length > BACKUP_KEEP) {
      const idsToDelete = old.slice(BACKUP_KEEP).map((r) => r.id);
      await sbRest("app_state_backup", {
        method: "DELETE",
        filter: { id: `in.(${idsToDelete.join(",")})` },
      });
    }
  } catch (error) {
    console.error("Falha ao gravar backup (escrita principal continua):", error.message);
  }
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://bignordesteanalytics.vercel.app").split(",").filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], maxAge: 3600 }));

app.use((req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const count = (requestCounts.get(ip) || 0) + 1;
  requestCounts.set(ip, count);
  if (count > 1000 && Math.random() > 0.99) requestCounts.delete(ip);
  if (count > 1000) return res.status(429).json({ error: "Rate limit exceeded" });
  next();
});

const auditLog = (action, user, details) =>
  console.log(`[AUDIT] ${new Date().toISOString()} | ${action} | ${user || "ANON"} | ${JSON.stringify(details)}`);

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

const bucketsByType = {
  resumo_geral_loja: "resumos",
  campanhas_ofertas: "campanhas",
  produtos_campanha: "produtos",
  departamentos_campanha: "departamentos",
  cupons_totais: "cupons",
  venda_departamento_total: "deptTotais",
  ofertas_dia_campanha: "ofertasDia",
  venda_diaria_loja: "vendasDiarias",
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

const GUARDED_BUCKETS = ["empresas", "resumos", "campanhas", "departamentos", "produtos", "cupons", "ofertasDia", "vendasDiarias", "deptTotais"];
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP || 30);

function bucketCounts(state) {
  const out = {};
  for (const key of GUARDED_BUCKETS) out[key] = Array.isArray(state && state[key]) ? state[key].length : 0;
  return out;
}

function detectShrink(prev, incoming) {
  if (!prev) return [];
  return GUARDED_BUCKETS.map((bucket) => ({ bucket, from: (prev[bucket] || []).length, to: (incoming[bucket] || []).length })).filter((x) => x.to < x.from);
}

// ─── Routes ────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try {
    if (!dbConfigured) return res.json({ ok: true, database: "not_configured", protected: Boolean(apiToken) });
    try {
      await sbRest("app_state", { select: "id", limit: 1 });
      res.json({ ok: true, database: "connected", protected: Boolean(apiToken) });
    } catch (dbError) {
      console.log("Erro ao conectar ao banco em /api/health:", dbError.message);
      res.json({ ok: true, database: "disconnected", protected: Boolean(apiToken), error: dbError.message });
    }
  } catch (error) {
    console.error("Erro em /api/health:", error.message);
    res.json({ ok: true, database: "disconnected", protected: Boolean(apiToken), error: error.message });
  }
});

app.get("/api/state", authRequired, async (req, res) => {
  auditLog("GET_STATE", req.headers.authorization ? "AUTHENTICATED" : "ANONYMOUS", { ip: req.ip });
  try {
    if (!dbConfigured) {
      console.log("Supabase nao configurado, usando localStorage fallback");
      return res.json(null);
    }
    try {
      const data = await sbGetState();
      res.json(data || null);
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
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    const data = await sbGetState();
    if (!data) return res.json({ produtos: [] });
    const unclassified = new Set();
    const badDepts = new Set(["", "OUTROS", "A ACERTAR", "SEM DEPARTAMENTO", "NAO DEFINIDO", "INDEFINIDO", "SEM CLASSIFICACAO"]);
    (data.produtos || []).forEach((p) => {
      const dept = (p.descricao_departamento || "").trim().toUpperCase();
      if (badDepts.has(dept)) {
        const desc = (p.descricao_produto || "").trim() || "[VAZIO]";
        unclassified.add(desc);
      }
    });
    res.json({ produtos: [...unclassified].sort().map((d) => ({ descricao: d })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/state", authRequired, async (req, res) => {
  auditLog("PUT_STATE", req.headers.authorization ? "AUTHENTICATED" : "ANONYMOUS", { ip: req.ip, size_bytes: JSON.stringify(req.body).length });
  try {
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    const force = Boolean(apiToken) && (req.query.force === "1" || req.headers["x-force-write"] === "1");
    const incoming = normalizeState(req.body);
    const prev = await sbGetState();
    const shrunk = detectShrink(prev, incoming);
    if (shrunk.length && !force) {
      return res.status(409).json({
        error: "Gravacao bloqueada: reduziria dados existentes",
        shrunk,
        counts: bucketCounts(prev),
      });
    }
    await sbBackup(prev, "put");
    await sbUpsertState(incoming);
    res.json({ ok: true, counts: bucketCounts(incoming) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/import-batch", authRequired, async (req, res) => {
  try {
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    const { loja, ini, fim, hasMonthly, groups = [], hist = [] } = req.body || {};
    if (!loja || !ini || !fim || !Array.isArray(groups)) {
      return res.status(400).json({ error: "Payload de importacao invalido" });
    }

    const prevState = await sbGetState();
    await sbBackup(prevState, "import:" + loja);
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
      const filtered = state[bucket].filter(
        (row) => !(row.loja == loja && row.__tipo == tipo && (diario ? inDatePeriod(row.data, ini, fim) : allowedMonths.includes(monthKey(row.mes))))
      );
      const deleted = before - filtered.length;
      if (deleted > 0 && rows.length === 0) {
        throw new Error(`Seguranca: tentativa de deletar ${deleted} rows do bucket ${bucket} SEM adicionar dados novos para ${loja}/${tipo}. Isso indica um problema na importacao.`);
      }
      state[bucket] = filtered.concat(rows);
    }

    if (hist.length) state.importacoes.unshift(...hist);

    await sbUpsertState(state);

    res.json({
      ok: true,
      rows: groups.reduce((sum, group) => sum + (Array.isArray(group.rows) ? group.rows.length : 0), 0),
      ofertasDia: state.ofertasDia.length,
      vendasDiarias: state.vendasDiarias.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/backups", authRequired, async (_req, res) => {
  try {
    if (!dbConfigured) {
      console.log("Supabase nao configurado, retornando backups vazio");
      return res.json([]);
    }
    try {
      const rows = await sbRest("app_state_backup", {
        filter: { state_id: "eq.main" },
        select: "id,reason,created_at",
        order: "created_at.desc",
        limit: BACKUP_KEEP,
      });
      res.json(rows.map((row) => ({ id: row.id, reason: row.reason, created_at: row.created_at })));
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
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    if (!apiToken) return res.status(403).json({ error: "Restauracao desabilitada: configure API_TOKEN para habilitar" });
    const backupId = req.params.id;
    const backup = await sbRest("app_state_backup", {
      filter: { id: `eq.${backupId}`, state_id: "eq.main" },
      select: "data",
      single: true,
    });
    if (!backup) return res.status(404).json({ error: "Backup nao encontrado" });
    const restoreData = backup.data;
    const current = await sbGetState();
    await sbBackup(current, "pre-restore");
    await sbUpsertState(restoreData);
    res.json({ ok: true, restored: backupId, counts: bucketCounts(restoreData) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/empresas", authRequired, async (req, res) => {
  try {
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    const { empresas, regioes, renames } = req.body || {};
    if (!Array.isArray(empresas)) return res.status(400).json({ error: "empresas deve ser um array" });

    const prev = await sbGetState();
    await sbBackup(prev, "patch-empresas");
    const state = normalizeState(prev || {});

    if (Array.isArray(renames)) {
      for (const { from, to } of renames) {
        if (!from || !to || from === to) continue;
        ["resumos", "campanhas", "departamentos", "produtos", "cupons", "ofertasDia", "vendasDiarias", "deptTotais"].forEach((bucket) => {
          (state[bucket] || []).forEach((row) => {
            if (row.loja === from) row.loja = to;
          });
        });
        (state.importacoes || []).forEach((row) => {
          if (row.loja === from) row.loja = to;
        });
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

    await sbUpsertState(state);
    res.json({ ok: true, counts: bucketCounts(state) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/aprovacoes", authRequired, async (req, res) => {
  try {
    if (!dbConfigured) return res.status(503).json({ error: "Supabase nao configurado" });
    const { updates } = req.body || {};
    if (!updates || typeof updates !== "object") return res.status(400).json({ error: "updates deve ser um objeto" });

    const prev = await sbGetState();
    await sbBackup(prev, "patch-aprovacoes");
    const state = normalizeState(prev || {});

    if (!state.aprovacoes) state.aprovacoes = {};
    Object.entries(updates).forEach(([key, val]) => {
      state.aprovacoes[key] = val;
    });

    await sbUpsertState(state);
    res.json({ ok: true });
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
    console.log(`BIGNORDESTE ANALYTICS rodando em http://127.0.0.1:${port}`);
    console.log(dbConfigured ? "Supabase REST API configurado." : "SUPABASE_URL/SUPABASE_SECRET_KEY nao configurados; API de banco desativada.");
    console.log(apiToken ? "API protegida por token." : "AVISO: API_TOKEN nao configurado, API sem autenticacao.");
  });
}

module.exports = app;
