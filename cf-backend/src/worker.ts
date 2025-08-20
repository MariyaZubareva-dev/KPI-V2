/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  COMMON_PASSWORD: string;
  CORS_ORIGIN?: string; // напр. https://mariyazubareva-dev.github.io
}

/* ================== утилиты ================== */

function mergeHeaders(base: HeadersInit, extra?: HeadersInit): Headers {
  const h = new Headers(base);
  if (extra) new Headers(extra).forEach((v, k) => h.set(k, v));
  return h;
}
function jsonResp(obj: unknown, init: ResponseInit = {}): Response {
  const headers = mergeHeaders({ "content-type": "application/json; charset=utf-8" }, init.headers);
  return new Response(JSON.stringify(obj), { status: init.status ?? 200, headers });
}
function ok(data: unknown): Response { return jsonResp({ success: true, data }); }
function err(message: string, status = 400): Response { return jsonResp({ success: false, message }, { status }); }

function allowOrigin(env: Env): string { return env.CORS_ORIGIN?.trim() ? env.CORS_ORIGIN : "*"; }
function addSecurityHeaders(h: Headers) {
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "no-referrer-when-downgrade");
  h.set("X-Frame-Options", "DENY");
}
function withCORS(env: Env, res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin(env));
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Access-Control-Allow-Credentials", "false");
  headers.set("Vary", "Origin");
  addSecurityHeaders(headers);
  return new Response(res.body, { status: res.status, headers });
}
function isPreflight(req: Request) { return req.method === "OPTIONS"; }

/* ================ даты/периоды ================= */

function startOfDay(d: Date) { const nd = new Date(d); nd.setHours(0,0,0,0); return nd; }
function endOfDay(d: Date)   { const nd = new Date(d); nd.setHours(23,59,59,999); return nd; }
function fmtYYYYMMDD(d: Date) {
  const y = d.getFullYear(), m = `${d.getMonth()+1}`.padStart(2,"0"), day = `${d.getDate()}`.padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}
function getLastFullWeekBounds(ref?: Date) {
  const now = ref ? new Date(ref) : new Date();
  const thisWeek = getWeekBounds(now);
  const end = new Date(thisWeek.start); end.setDate(end.getDate() - 1); end.setHours(23,59,59,999);
  const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
  return { start, end };
}
function getWeekNumberISO(dIn: Date) {
  const d = new Date(Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* ================ SQL helpers ================= */

async function one<T = any>(db: D1Database, sql: string, bind: any[] = []): Promise<T | null> {
  const r = await db.prepare(sql).bind(...bind).first<T>();
  return (r ?? null) as T | null;
}
async function all<T = any>(db: D1Database, sql: string, bind: any[] = []): Promise<T[]> {
  const r = await db.prepare(sql).bind(...bind).all<T>();
  return (r.results ?? []) as T[];
}

/* =============== Cache helpers ================= */

const DEFAULT_TTL = 60; // секунд
async function cacheGet(env: Env, req: Request, compute: () => Promise<Response>, ttl = DEFAULT_TTL): Promise<Response> {
  if (req.method !== "GET") return withCORS(env, await compute());
  const cfCache = (globalThis as any)?.caches?.default as Cache | undefined;
  const key = new Request(req.url, { method: "GET" });
  if (cfCache) {
    const cached = await cfCache.match(key);
    if (cached) return withCORS(env, cached);
  }
  const fresh = await compute();
  const headers = new Headers(fresh.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}`);
  headers.set("Vary", "Origin");
  addSecurityHeaders(headers);
  const cacheable = new Response(fresh.body, { status: fresh.status, headers });
  if (cfCache) await cfCache.put(key, cacheable.clone());
  return withCORS(env, cacheable);
}
async function purgeProgressCache(base: URL) {
  const cfCache = (globalThis as any)?.caches?.default as Cache | undefined;
  if (!cfCache) return;
  const paths = ["/getprogress?scope=department","/getprogress?scope=users","/getprogress?scope=users_lastweek","/bootstrap"];
  await Promise.all(paths.map((p) => cfCache.delete(new Request(new URL(p, base).toString(), { method: "GET" }))));
}

/* ============ settings helpers ============ */
async function ensureSettingsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS settings (
       key   TEXT PRIMARY KEY,
       value TEXT NOT NULL
     )`
  ).run();
}
async function getSetting(env: Env, key: string): Promise<string | null> {
  await ensureSettingsTable(env);
  const row = await one<{ value: string }>(env.DB, `SELECT value FROM settings WHERE key=?`, [key]);
  return row?.value ?? null;
}
async function getRepeatPolicy(env: Env): Promise<'unlimited'|'per_day'|'per_week'> {
  const val = (await getSetting(env, "repeat_policy")) || "unlimited";
  const v = val.toLowerCase();
  return (v === "per_day" || v === "per_week") ? v as any : "unlimited";
}

async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await ensureSettingsTable(env);
  await env.DB.prepare(
    `INSERT INTO settings(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).bind(key, value).run();
}

/* ================ handlers ================= */

async function handlePing() { return ok({ ok: true, pong: true }); }

// GET /login?email=&password=
async function handleLogin(env: Env, url: URL) {
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const password = url.searchParams.get("password") || "";
  if (!email || !password) return err("email and password required");
  if (password !== env.COMMON_PASSWORD) return jsonResp({ success: false });
  const u = await one<{ id: number; name: string; email: string; role: string }>(
    env.DB, `SELECT id, name, email, role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [email]
  );
  if (!u) return jsonResp({ success: false });
  return jsonResp({ success: true, email: u.email, role: u.role, name: u.name });
}

// GET /getprogress?scope=...
async function handleGetProgress(env: Env, url: URL) {
  const scope = (url.searchParams.get("scope") || "department").toLowerCase();
  if (scope === "department")     return handleGetDeptProgress(env);
  if (scope === "users")          return handleGetUsersProgress(env, url);
  if (scope === "users_lastweek") return handleGetUsersProgressLastWeek(env);
  if (scope === "user")           return handleGetUserKPIs(env, url);
  return err("Unknown scope");
}

// === department
async function handleGetDeptProgress(env: Env) {
  const now = new Date();
  const { start, end } = getWeekBounds(now);
  const month = now.getMonth();
  const year  = now.getFullYear();

  const weekSum = Number((await one<{ sum: number }>(env.DB,
    `SELECT COALESCE(SUM(score),0) AS sum FROM progress WHERE date BETWEEN ? AND ?`,
    [fmtYYYYMMDD(start), fmtYYYYMMDD(end)]) )?.sum || 0);

  const monthSum = Number((await one<{ sum: number }>(env.DB,
    `SELECT COALESCE(SUM(score),0) AS sum FROM progress
     WHERE strftime('%Y', date)=? AND strftime('%m', date)=?`,
    [String(year), `${month + 1}`.padStart(2, "0")] ))?.sum || 0);

  const weightsSum = Number((await one<{ sum: number }>(env.DB,
    `SELECT COALESCE(SUM(weight),0) AS sum FROM kpis WHERE active=1`))?.sum || 0);

  const employeesCount = Number((await one<{ cnt: number }>(env.DB,
    `SELECT COUNT(1) AS cnt FROM users WHERE active=1 AND lower(role)='employee'`))?.cnt || 1);

  const maxWeek = weightsSum * employeesCount;

  // кол-во ISO-недель в месяце
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const weekKeys = new Set<string>();
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear(); const w = getWeekNumberISO(d); weekKeys.add(`${y}-${w}`);
  }
  const weeksInMonth = weekKeys.size;
  const maxMonth = maxWeek * weeksInMonth;

  const weekPercent  = Math.min(100, Math.round((weekSum  / (maxWeek  || 1)) * 100));
  const monthPercent = Math.min(100, Math.round((monthSum / (maxMonth || 1)) * 100));

  // Глобальная цель (auto-create таблицы)
  const goalStr = await getSetting(env, "month_goal");
  const goalMonth = Math.max(1, Number(goalStr || "100"));
  const goalPercent = Math.min(100, Math.round((monthSum / goalMonth) * 100));

  return ok({
    weekSum, monthSum, maxWeek, maxMonth, weeksInMonth, employeesCount,
    weekPercent, monthPercent,
    goalMonth, goalPercent
  });
}

// === users (текущая неделя + текущий месяц), поддерживает ?period=prev_week
async function handleGetUsersProgress(env: Env, url: URL) {
  const period = (url.searchParams.get("period") || "this_week").toLowerCase();
  const now = new Date();
  const bounds = period === "prev_week"
    ? getWeekBounds(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7))
    : getWeekBounds(now);
  const { start, end } = bounds;
  const year = String(now.getFullYear());
  const monthStr = `${now.getMonth() + 1}`.padStart(2, "0");

  const users = await all<{ id: number; name: string; email: string; role: string }>(
    env.DB, `SELECT id, name, email, role FROM users WHERE active=1`
  );
  const weekRows = await all<{ user_id: number; sum: number }>(
    env.DB,
    `SELECT user_id, COALESCE(SUM(score),0) AS sum
     FROM progress
     WHERE date BETWEEN ? AND ?
     GROUP BY user_id`,
    [fmtYYYYMMDD(start), fmtYYYYMMDD(end)]
  );
  const weekMap = new Map<number, number>(weekRows.map(r => [r.user_id, Number(r.sum || 0)]));

  const monthRows = await all<{ user_id: number; sum: number }>(
    env.DB,
    `SELECT user_id, COALESCE(SUM(score),0) AS sum
     FROM progress
     WHERE strftime('%Y', date)=? AND strftime('%m', date)=?
     GROUP BY user_id`,
    [year, monthStr]
  );
  const monthMap = new Map<number, number>(monthRows.map(r => [r.user_id, Number(r.sum || 0)]));

  const data = users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    week: weekMap.get(u.id) || 0, month: monthMap.get(u.id) || 0
  }));
  return ok(data);
}

// === users_lastweek
async function handleGetUsersProgressLastWeek(env: Env) {
  const { start, end } = getLastFullWeekBounds(new Date());
  const users = await all<{ id: number; name: string; email: string; role: string }>(
    env.DB, `SELECT id, name, email, role FROM users WHERE active=1`
  );
  const weekRows = await all<{ user_id: number; sum: number }>(
    env.DB,
    `SELECT user_id, COALESCE(SUM(score),0) AS sum
     FROM progress
     WHERE date BETWEEN ? AND ?
     GROUP BY user_id`,
    [fmtYYYYMMDD(start), fmtYYYYMMDD(end)]
  );
  const weekMap = new Map<number, number>(weekRows.map(r => [r.user_id, Number(r.sum || 0)]));
  const data = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, week: weekMap.get(u.id) || 0, month: 0 }));
  return ok(data);
}

// === /bootstrap — единый батч
async function handleBootstrap(env: Env, url: URL) {
  // просто проксируем уже посчитанные хендлеры, чтобы не дублировать код
  const deptResp = await handleGetDeptProgress(env);
  const dept = await deptResp.json().then((j:any)=>j.data);
  const usersResp = await handleGetUsersProgress(env, new URL(url));
  const users = await usersResp.json().then((j:any)=>j.data);
  const prev = await handleGetUsersProgressLastWeek(env);
  const usersPrevWeek = await prev.json().then((j:any)=>j.data);
  return ok({ dept, users, usersPrevWeek });
}

// === user KPIs за текущую неделю
// === user KPIs (список KPI + признак done по policy)
async function handleGetUserKPIs(env: Env, url: URL) {
  const userID = url.searchParams.get("userID");
  if (!userID) return err("userID required");

  // Дата может прийти из UI (для показа "уже отмечено" по policy)
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD | null
  const policy  = await getRepeatPolicy(env);

  let rangeStart: Date, rangeEnd: Date;
  if (policy === "per_day" && dateStr) {
    const d = new Date(dateStr);
    rangeStart = startOfDay(d);
    rangeEnd   = endOfDay(d);
  } else if (policy === "per_week") {
    const ref = dateStr ? new Date(dateStr) : new Date();
    const b = getWeekBounds(ref);
    rangeStart = b.start; rangeEnd = b.end;
  } else {
    // unlimited: флаг done всегда false (не ограничиваем повторы)
    rangeStart = new Date(0); rangeEnd = new Date(0);
  }

  const kpis = await all<{ id:number; name:string; weight:number; category?:string; active:number }>(
    env.DB,
    `SELECT id, name, weight, category, active FROM kpis WHERE active=1 ORDER BY weight DESC, id ASC`
  );

  let doneSet = new Set<number>();
  if (policy !== "unlimited") {
    const rows = await all<{ kpi_id:number }>(
      env.DB,
      `SELECT DISTINCT kpi_id FROM progress
       WHERE user_id=? AND date BETWEEN ? AND ?`,
      [userID, fmtYYYYMMDD(rangeStart), fmtYYYYMMDD(rangeEnd)]
    );
    doneSet = new Set<number>(rows.map(r => r.kpi_id));
  }

  const data = kpis.map(k => ({
    KPI_ID: String(k.id),
    name: k.name,
    weight: Number(k.weight || 0),
    done: policy === "unlimited" ? false : doneSet.has(k.id)
  }));

  return ok(data);
}


// GET /recordkpi?userID=&kpiId=&actorEmail[&date=YYYY-MM-DD]
async function handleRecordKPI(env: Env, url: URL) {
  const userID     = url.searchParams.get("userID");
  const kpiId      = url.searchParams.get("kpiId");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  const dateStr    = url.searchParams.get("date") || fmtYYYYMMDD(new Date());
  if (!userID || !kpiId)   return err("userID and kpiId required");
  if (!actorEmail)         return err("forbidden: actorEmail required", 403);

  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") {
    await logEvent(env, "kpi_record_forbidden", actorEmail, Number(userID), Number(kpiId), null, { reason: "not_admin" });
    return err("forbidden: only admin can record KPI", 403);
  }
  const kpi = await one<{ weight: number }>(env.DB, `SELECT weight FROM kpis WHERE id=? AND active=1`, [kpiId]);
  if (!kpi) return err("invalid kpiId");

  await env.DB.prepare(`INSERT INTO progress (user_id, date, kpi_id, completed, score) VALUES (?, ?, ?, 1, ?)`)
    .bind(userID, dateStr, kpiId, kpi.weight || 0).run();

  await logEvent(env, "kpi_recorded_backend", actorEmail, Number(userID), Number(kpiId), Number(kpi.weight || 0), { date: dateStr });
  await purgeProgressCache(url);
  return ok({ userID, kpiId, score: kpi.weight || 0, date: dateStr });
}

// GET /log?event=&email=&userID=&details=JSON
async function handleLog(env: Env, url: URL) {
  const event   = url.searchParams.get("event") || "unknown";
  const email   = (url.searchParams.get("email") || "").trim().toLowerCase();
  const userID  = url.searchParams.get("userID");
  const details = url.searchParams.get("details");
  await env.DB.prepare(`INSERT INTO logs (event, actor_email, user_id, details) VALUES (?, ?, ?, ?)`)
    .bind(event, email || null, userID ? Number(userID) : null, details || null).run();
  return jsonResp({ success: true });
}
async function logEvent(env: Env, event: string, actorEmail?: string | null, userId?: number | null, kpiId?: number | null, score?: number | null, details?: Record<string, unknown> | null) {
  await env.DB.prepare(
    `INSERT INTO logs (event, actor_email, user_id, kpi_id, score, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(event, actorEmail || null, userId ?? null, kpiId ?? null, score ?? null, details ? JSON.stringify(details) : null).run();
}

/* ---------- История отметок ---------- */

async function handleProgressList(env: Env, url: URL) {
  const userID = url.searchParams.get("userID");
  const from   = url.searchParams.get("from");
  const to     = url.searchParams.get("to");
  const limit  = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

  const conds: string[] = [], bind: any[] = [];
  if (userID) { conds.push("p.user_id = ?"); bind.push(userID); }
  if (from)   { conds.push("p.date >= ?");   bind.push(from); }
  if (to)     { conds.push("p.date <= ?");   bind.push(to); }
  const where = conds.length ? ("WHERE " + conds.join(" AND ")) : "";

  const sql = `
    SELECT p.rowid AS id, p.user_id, p.date, p.kpi_id, p.score,
           k.name AS kpi_name, u.name AS user_name
    FROM progress p
    JOIN kpis   k ON k.id = p.kpi_id
    JOIN users  u ON u.id = p.user_id
    ${where}
    ORDER BY p.date DESC, id DESC
    LIMIT ${limit}
  `;
  const rows = await all<any>(env.DB, sql, bind);
  return ok(rows);
}

async function handleProgressDelete(env: Env, url: URL) {
  const idStr      = url.searchParams.get("id");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!idStr)      return err("id required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);

  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") {
    await logEvent(env, "progress_delete_forbidden", actorEmail, null, null, null, { id: idStr });
    return err("forbidden: only admin can delete progress", 403);
  }
  await env.DB.prepare(`DELETE FROM progress WHERE rowid = ?`).bind(idStr).run();
  await logEvent(env, "progress_deleted", actorEmail, null, null, null, { id: idStr });
  await purgeProgressCache(new URL(url.toString()));
  return ok({ id: Number(idStr) });
}

/* ---------- Лидерборд ---------- */

async function handleLeaderboard(env: Env, url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const includeAll = (url.searchParams.get("include_all") || "0") === "1";
  if (!from || !to) return err("from and to required");

  const rows = await all<{ id: number; name: string; email: string; role: string; sum: number }>(
    env.DB,
    `SELECT u.id AS id, u.name, u.email, u.role,
            COALESCE(SUM(p.score), 0) AS sum
     FROM users u
     LEFT JOIN progress p ON p.user_id = u.id AND p.date BETWEEN ? AND ?
     WHERE u.active = 1
     GROUP BY u.id, u.name, u.email, u.role
     ORDER BY sum DESC, u.name ASC`,
    [from, to]
  );

  const data = rows
    .filter(r => String(r.role || "").toLowerCase() === "employee")
    .filter(r => includeAll ? true : Number(r.sum || 0) > 0)
    .map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, points: Number(r.sum || 0) }));
  return ok(data);
}

/* ---------- KPI CRUD ---------- */

async function handleKpiList(env: Env, url: URL) {
  const includeInactive = (url.searchParams.get("include_inactive") || "0") === "1";
  const rows = await all<{ id:number; name:string; weight:number; active:number }>(
    env.DB,
    `SELECT id, name, weight, active
     FROM kpis
     ${includeInactive ? "" : "WHERE active=1"}
     ORDER BY active DESC, weight DESC, id ASC`
  );
  return ok(rows.map(r => ({ ...r, weight: Number(r.weight || 0), active: Number(r.active||0) })));
}
async function handleKpiCreate(env: Env, url: URL) {
  const name = (url.searchParams.get("name") || "").trim();
  const weight = Number(url.searchParams.get("weight") || "0");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!name || !(weight > 0)) return err("name and weight>0 required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can create KPI", 403);

  await env.DB.prepare(`INSERT INTO kpis (name, weight, active) VALUES (?, ?, 1)`).bind(name, weight).run();
  await logEvent(env, "kpi_created", actorEmail, null, null, weight, { name });
  await purgeProgressCache(url);
  return ok({ name, weight });
}
async function handleKpiUpdate(env: Env, url: URL) {
  const id = Number(url.searchParams.get("id") || "0");
  const name = (url.searchParams.get("name") || "").trim();
  const weight = Number(url.searchParams.get("weight") || "0");
  const active = (url.searchParams.get("active") || "1") === "1" ? 1 : 0;
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!(id>0) || !name || !(weight>0)) return err("id, name and weight>0 required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can update KPI", 403);

  await env.DB.prepare(`UPDATE kpis SET name=?, weight=?, active=? WHERE id=?`).bind(name, weight, active, id).run();
  await logEvent(env, "kpi_updated", actorEmail, null, id, weight, { name, active });
  await purgeProgressCache(url);
  return ok({ id, name, weight, active });
}
async function handleKpiDelete(env: Env, url: URL) {
  const id = Number(url.searchParams.get("id") || "0");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!(id>0)) return err("id required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can delete KPI", 403);

  await env.DB.prepare(`UPDATE kpis SET active=0 WHERE id=?`).bind(id).run();
  await logEvent(env, "kpi_deleted", actorEmail, null, id, null, null);
  await purgeProgressCache(url);
  return ok({ id, active: 0 });
}

/* ---------- SETTINGS ---------- */

async function handleSettingsGet(env: Env, url: URL) {
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return err("key required");
  const value = await getSetting(env, key); // ensureSettingsTable внутри
  return ok({ key, value });
}
async function handleSettingsSet(env: Env, url: URL) {
  const key = (url.searchParams.get("key") || "").trim();
  const value = (url.searchParams.get("value") || "").trim();
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!key)   return err("key required");
  if (!value) return err("value required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);

  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can set settings", 403);

  await setSetting(env, key, value); // ensureSettingsTable внутри
  await logEvent(env, "settings_updated", actorEmail, null, null, null, { key, value });
  await purgeProgressCache(url);
  return ok({ key, value });
}

/* ---------- USERS CRUD ---------- */

async function handleUsersList(env: Env, url: URL) {
  const includeInactive = (url.searchParams.get("include_inactive") || "0") === "1";
  const rows = await all<{id:number;name:string;email:string;role:string;active:number;manager_id:number|null}>(
    env.DB,
    `SELECT id, name, email, role, active, manager_id
     FROM users
     ${includeInactive ? "" : "WHERE active=1"}
     ORDER BY active DESC, lower(role)='admin' DESC, name ASC`
  );
  return ok(rows);
}
async function handleUserCreate(env: Env, url: URL) {
  const name = (url.searchParams.get("name") || "").trim();
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const role = (url.searchParams.get("role") || "employee").trim().toLowerCase();
  const managerId = url.searchParams.get("manager_id");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!name || !email) return err("name and email required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can create user", 403);

  await env.DB.prepare(
    `INSERT INTO users (name, email, role, active, manager_id) VALUES (?, ?, ?, 1, ?)`
  ).bind(name, email, role, managerId ? Number(managerId) : null).run();

  await logEvent(env, "user_created", actorEmail, null, null, null, { name, email, role, managerId });
  return ok({ name, email, role, manager_id: managerId ? Number(managerId) : null, active: 1 });
}
async function handleUserUpdate(env: Env, url: URL) {
  const id = Number(url.searchParams.get("id") || "0");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!(id>0)) return err("id required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can update user", 403);

  const fields: string[] = []; const bind: any[] = [];
  const add = (sql: string, v: any) => { fields.push(sql); bind.push(v); };

  const name = url.searchParams.get("name");
  const email = url.searchParams.get("email");
  const role  = url.searchParams.get("role");
  const activeStr = url.searchParams.get("active");
  const managerId = url.searchParams.get("manager_id");
  if (name !== null && name !== undefined) add("name=?", name.trim());
  if (email !== null && email !== undefined) add("email=?", email.trim().toLowerCase());
  if (role !== null && role !== undefined) add("role=?", role.trim().toLowerCase());
  if (activeStr !== null && activeStr !== undefined) add("active=?", (activeStr === "1" ? 1 : 0));
  if (managerId !== null && managerId !== undefined) add("manager_id=?", managerId ? Number(managerId) : null);
  if (!fields.length) return err("no fields to update");

  bind.push(id);
  await env.DB.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id=?`).bind(...bind).run();
  await logEvent(env, "user_updated", actorEmail, id, null, null, { fields });
  return ok({ id });
}
async function handleUserDelete(env: Env, url: URL) {
  const id = Number(url.searchParams.get("id") || "0");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  if (!(id>0)) return err("id required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);
  const admin = await one<{ role: string }>(env.DB, `SELECT role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`, [actorEmail]);
  if (!admin || (admin.role || "").toLowerCase() !== "admin") return err("forbidden: only admin can delete user", 403);

  await env.DB.prepare(`UPDATE users SET active=0 WHERE id=?`).bind(id).run();
  await logEvent(env, "user_deleted", actorEmail, id, null, null, null);
  return ok({ id, active: 0 });
}

/* =============== маршрутизация ================= */

function pathRoute(url: URL): string {
  let p = url.pathname.toLowerCase();
  if (p.endsWith("/") && p !== "/") p = p.slice(0, -1);
  return p;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (isPreflight(req)) {
      return withCORS(env, new Response(null, { status: 204, headers: { "Access-Control-Max-Age": "86400" } }));
    }

    const url = new URL(req.url);
    const route = pathRoute(url);

    try {
      // Кэширующие маршруты (GET агрегаты)
      if (req.method === "GET" && (route === "/getprogress" || route === "/bootstrap")) {
        if (route === "/bootstrap") return cacheGet(env, req, () => handleBootstrap(env, url), DEFAULT_TTL);
        const scope = (url.searchParams.get("scope") || "department").toLowerCase();
        const cacheable = scope === "department" || scope === "users" || scope === "users_lastweek";
        if (cacheable) return cacheGet(env, req, () => handleGetProgress(env, url), DEFAULT_TTL);
        return withCORS(env, await handleGetProgress(env, url));
      }

      let res: Response;
      if (route === "/ping")                 res = await handlePing();
      else if (route === "/login")           res = await handleLogin(env, url);
      else if (route === "/recordkpi")       res = await handleRecordKPI(env, url);
      else if (route === "/log")             res = await handleLog(env, url);
      else if (route === "/bootstrap")       res = await handleBootstrap(env, url);
      else if (route === "/progress_list")   res = await handleProgressList(env, url);
      else if (route === "/progress_delete") res = await handleProgressDelete(env, url);
      else if (route === "/leaderboard")     res = await handleLeaderboard(env, url);
      else if (route === "/kpi_list")        res = await handleKpiList(env, url);
      else if (route === "/kpi_create")      res = await handleKpiCreate(env, url);
      else if (route === "/kpi_update")      res = await handleKpiUpdate(env, url);
      else if (route === "/kpi_delete")      res = await handleKpiDelete(env, url);
      else if (route === "/settings_get")    res = await handleSettingsGet(env, url); // ← добавлено
      else if (route === "/settings_set")    res = await handleSettingsSet(env, url); // ← добавлено
      else if (route === "/users_list")      res = await handleUsersList(env, url);
      else if (route === "/user_create")     res = await handleUserCreate(env, url);
      else if (route === "/user_update")     res = await handleUserUpdate(env, url);
      else if (route === "/user_delete")     res = await handleUserDelete(env, url);
      else                                   res = err("Invalid action", 400);

      return withCORS(env, res);
    } catch (e: any) {
      const msg = (e && e.message) ? String(e.message) : "Internal error";
      return withCORS(env, jsonResp({ success: false, message: msg }, { status: 500 }));
    }
  },
};
