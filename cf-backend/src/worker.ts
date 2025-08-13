// src/worker.ts
// Cloudflare Worker + D1. Поддерживает маршруты:
// /ping, /login, /getProgress, /recordKPI, /log
// и обратную совместимость с GAS: ?action=...

export interface Env {
  DB: D1Database;
  COMMON_PASSWORD: string;
  CORS_ORIGIN?: string;
}

/* ===================== utils ===================== */

const jsonResp = (obj: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
    status: init.status ?? 200,
  });

const ok  = (data: unknown)               => jsonResp({ success: true, data });
const err = (message: string, status=400) => jsonResp({ success: false, message }, { status });

function allowOrigin(env: Env): string {
  return env.CORS_ORIGIN && env.CORS_ORIGIN.trim() !== "" ? env.CORS_ORIGIN : "*";
}

function withCORS(env: Env, res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin(env));
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  // важное: разрешаем If-None-Match для conditional requests
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,If-None-Match");
  headers.set("Access-Control-Allow-Credentials", "false");
  return new Response(res.body, { status: res.status, headers });
}

function isPreflight(req: Request) {
  return req.method === "OPTIONS";
}

function parseBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return false;
}

/* ===================== dates ===================== */

function startOfDay(d: Date) { const nd = new Date(d); nd.setHours(0,0,0,0); return nd; }
function endOfDay(d: Date)   { const nd = new Date(d); nd.setHours(23,59,59,999); return nd; }

function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}

function getLastFullWeekBounds(ref?: Date) {
  const now = ref ? new Date(ref) : new Date();
  const thisWeek = getWeekBounds(now);
  const end = new Date(thisWeek.start);
  end.setDate(end.getDate() - 1);
  end.setHours(23,59,59,999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0,0,0,0);
  return { start, end };
}

function fmtYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ===================== SQL helpers ===================== */

async function one<T = any>(db: D1Database, sql: string, bind: any[] = []): Promise<T | null> {
  const r = await db.prepare(sql).bind(...bind).first<T>();
  return (r ?? null) as T | null;
}

async function all<T = any>(db: D1Database, sql: string, bind: any[] = []): Promise<T[]> {
  const r = await db.prepare(sql).bind(...bind).all<T>();
  return (r.results ?? []) as T[];
}

/* ===================== ETag + memory cache ===================== */

// простенький FNV-1a для ETag (стронг/вик не важен; делаем стронг)
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  // uint32 to hex
  return (h >>> 0).toString(16);
}

type CacheEntry = { expires: number; etag: string; body: string };
const memCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 30_000;

// key нормализуем
function cacheKey(route: string, params: Record<string, string | number | undefined>) {
  const items = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort();
  return `${route}?${items.join("&")}`;
}

function cacheGet(req: Request, key: string): Response | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  const now = Date.now();
  if (hit.expires < now) {
    memCache.delete(key);
    return null;
  }
  // условная проверка
  const inm = req.headers.get("If-None-Match");
  if (inm && inm === hit.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "ETag": hit.etag,
        "Cache-Control": "public, max-age=30",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
  return new Response(hit.body, {
    status: 200,
    headers: {
      "ETag": hit.etag,
      "Cache-Control": "public, max-age=30",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cachePut(key: string, obj: unknown) {
  const body = JSON.stringify({ success: true, data: obj });
  const etag = fnv1a(body);
  memCache.set(key, { expires: Date.now() + DEFAULT_TTL_MS, etag, body });
  return new Response(body, {
    status: 200,
    headers: {
      "ETag": etag,
      "Cache-Control": "public, max-age=30",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// удобная обёртка для кэшируемых JSON-ответов
async function cacheJson(
  req: Request,
  routeKey: string,
  paramsKey: Record<string, string | number | undefined>,
  producer: () => Promise<unknown>
) {
  const key = cacheKey(routeKey, paramsKey);
  const cached = cacheGet(req, key);
  if (cached) return cached;
  const data = await producer();
  return cachePut(key, data);
}

/* ===================== handlers ===================== */

async function handlePing() { return ok({ ok: true, pong: true }); }

// GET /login?email=&password=
async function handleLogin(env: Env, url: URL) {
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const password = url.searchParams.get("password") || "";
  if (!email || !password) return err("email and password required");

  if (password !== env.COMMON_PASSWORD) return jsonResp({ success: false });

  const u = await one<{ id: number; name: string; email: string; role: string }>(
    env.DB,
    `SELECT id, name, email, role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`,
    [email]
  );

  if (!u) return jsonResp({ success: false });

  return jsonResp({
    success: true,
    email: u.email,
    role: u.role,
    name: u.name,
  });
}

// GET /getProgress?scope=...
async function handleGetProgress(env: Env, req: Request, url: URL) {
  const scope = (url.searchParams.get("scope") || "department").toLowerCase();

  if (scope === "department") {
    // кэшируется 30с
    return cacheJson(req, "/getprogress", { scope }, async () => {
      return await computeDeptProgress(env);
    });
  }

  if (scope === "users") {
    const period = (url.searchParams.get("period") || "this_week").toLowerCase();
    return cacheJson(req, "/getprogress", { scope, period }, async () => {
      return await computeUsersProgress(env, period);
    });
  }

  if (scope === "users_lastweek") {
    return cacheJson(req, "/getprogress", { scope: "users_lastweek" }, async () => {
      return await computeUsersLastWeek(env);
    });
  }

  if (scope === "user") {
    const userID = url.searchParams.get("userID") || "";
    const period = (url.searchParams.get("period") || "this_week").toLowerCase();
    if (!userID) return err("userID required");
    // кэш по userID + текущей неделе
    return cacheJson(req, "/getprogress", { scope: "user", userID, period }, async () => {
      return await computeUserKPIs(env, userID);
    });
  }

  return err("Unknown scope");
}

/* === department compute === */
async function computeDeptProgress(env: Env) {
  const now = new Date();
  const { start, end } = getWeekBounds(now);
  const month = now.getMonth();
  const year = now.getFullYear();

  const weekSumRow = await one<{ sum: number }>(
    env.DB,
    `SELECT COALESCE(SUM(score),0) AS sum
     FROM progress
     WHERE date BETWEEN ? AND ?`,
    [fmtYYYYMMDD(start), fmtYYYYMMDD(end)]
  );
  const weekSum = Number(weekSumRow?.sum || 0);

  const monthSumRow = await one<{ sum: number }>(
    env.DB,
    `SELECT COALESCE(SUM(score),0) AS sum
     FROM progress
     WHERE strftime('%Y', date)=? AND strftime('%m', date)=?`,
    [String(year), `${month + 1}`.padStart(2, "0")]
  );
  const monthSum = Number(monthSumRow?.sum || 0);

  const weightsRow = await one<{ sum: number }>(
    env.DB, `SELECT COALESCE(SUM(weight),0) AS sum FROM kpis WHERE active=1`
  );
  const weightsSum = Number(weightsRow?.sum || 0);

  const empRow = await one<{ cnt: number }>(
    env.DB, `SELECT COUNT(1) AS cnt FROM users WHERE active=1 AND lower(role)='employee'`
  );
  const employeesCount = Number(empRow?.cnt || 1);

  const maxWeek = weightsSum * employeesCount;

  // weeks in month (ISO)
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const weekKeys = new Set<string>();
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const w = getWeekNumberISO(d);
    weekKeys.add(`${y}-${w}`);
  }
  const weeksInMonth = weekKeys.size;
  const maxMonth = maxWeek * weeksInMonth;

  const weekPercent  = Math.min(100, Math.round((weekSum  / (maxWeek  || 1)) * 100));
  const monthPercent = Math.min(100, Math.round((monthSum / (maxMonth || 1)) * 100));

  return {
    weekSum, monthSum,
    maxWeek, maxMonth,
    weeksInMonth, employeesCount,
    weekPercent, monthPercent
  };
}

function getWeekNumberISO(dIn: Date) {
  const d = new Date(Date.UTC(dIn.getFullYear(), dIn.getMonth(), dIn.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* === users compute === */
async function computeUsersProgress(env: Env, period: "this_week" | "prev_week" | string) {
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

  return users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    week: weekMap.get(u.id) || 0,
    month: monthMap.get(u.id) || 0
  }));
}

async function computeUsersLastWeek(env: Env) {
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

  return users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    week: weekMap.get(u.id) || 0,
    month: 0
  }));
}

/* === user KPIs (текущая неделя) === */
async function computeUserKPIs(env: Env, userID: string) {
  const { start, end } = getWeekBounds(new Date());

  const kpis = await all<{ id: number; name: string; weight: number; category: string }>(
    env.DB, `SELECT id, name, weight, category FROM kpis WHERE active=1 ORDER BY weight DESC, id ASC`
  );

  const doneRows = await all<{ kpi_id: number }>(
    env.DB,
    `SELECT DISTINCT kpi_id
     FROM progress
     WHERE user_id = ? AND date BETWEEN ? AND ?`,
    [userID, fmtYYYYMMDD(start), fmtYYYYMMDD(end)]
  );
  const doneSet = new Set<number>(doneRows.map(r => r.kpi_id));

  return kpis.map(k => ({
    KPI_ID: String(k.id),
    name: k.name,
    weight: Number(k.weight || 0),
    done: doneSet.has(k.id)
  }));
}

/* === recordKPI === */
// GET /recordKPI?userID=&kpiId=&actorEmail[&date=YYYY-MM-DD]
async function handleRecordKPI(env: Env, url: URL) {
  const userID = url.searchParams.get("userID");
  const kpiId = url.searchParams.get("kpiId");
  const actorEmail = (url.searchParams.get("actorEmail") || "").trim().toLowerCase();
  const dateStr = url.searchParams.get("date") || fmtYYYYMMDD(new Date());

  if (!userID || !kpiId) return err("userID and kpiId required");
  if (!actorEmail) return err("forbidden: actorEmail required", 403);

  const admin = await one<{ id: number; role: string }>(
    env.DB,
    `SELECT id, role FROM users WHERE lower(email)=? AND active=1 LIMIT 1`,
    [actorEmail]
  );
  if (!admin || (admin.role || "").toLowerCase() !== "admin") {
    await logEvent(env, "kpi_record_forbidden", actorEmail, Number(userID), Number(kpiId), null, { reason: "not_admin" });
    return err("forbidden: only admin can record KPI", 403);
  }

  const kpi = await one<{ id: number; weight: number }>(
    env.DB, `SELECT id, weight FROM kpis WHERE id=? AND active=1`, [kpiId]
  );
  if (!kpi) return err("invalid kpiId");

  await env.DB
    .prepare(`INSERT INTO progress (user_id, date, kpi_id, completed, score) VALUES (?, ?, ?, 1, ?)`)
    .bind(userID, dateStr, kpiId, kpi.weight || 0)
    .run();

  await logEvent(env, "kpi_recorded_backend", actorEmail, Number(userID), Number(kpiId), Number(kpi.weight || 0), { date: dateStr });

  // Сбросим кэш: новые баллы должны сразу попадать в ответы
  memCache.clear();

  return ok({ userID, kpiId, score: kpi.weight || 0, date: dateStr });
}

/* === логирование произвольных событий === */
// GET /log?event=&email=&userID=&details=JSON
async function handleLog(env: Env, url: URL) {
  const event   = url.searchParams.get("event") || "unknown";
  const email   = (url.searchParams.get("email") || "").trim().toLowerCase();
  const userID  = url.searchParams.get("userID");
  const details = url.searchParams.get("details");

  await env.DB
    .prepare(`INSERT INTO logs (event, actor_email, user_id, details) VALUES (?, ?, ?, ?)`)
    .bind(event, email || null, userID ? Number(userID) : null, details || null)
    .run();

  return jsonResp({ success: true });
}

async function logEvent(
  env: Env,
  event: string,
  actorEmail?: string | null,
  userId?: number | null,
  kpiId?: number | null,
  score?: number | null,
  details?: Record<string, unknown> | null
) {
  await env.DB
    .prepare(
      `INSERT INTO logs (event, actor_email, user_id, kpi_id, score, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event,
      actorEmail || null,
      userId ?? null,
      kpiId ?? null,
      score ?? null,
      details ? JSON.stringify(details) : null
    )
    .run();
}

/* ===================== routing ===================== */

function pathRoute(url: URL): string {
  let p = url.pathname.toLowerCase();
  if (p.endsWith("/") && p !== "/") p = p.slice(0, -1);
  return p;
}

function actionRoute(url: URL): string | null {
  const action = url.searchParams.get("action");
  if (!action) return null;
  const a = action.toLowerCase();
  if (a === "login")       return "/login";
  if (a === "getprogress") return "/getprogress";
  if (a === "recordkpi")   return "/recordkpi";
  if (a === "log" || a === "logevent") return "/log";
  if (a === "ping")        return "/ping";
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (isPreflight(req)) {
      return withCORS(
        env,
        new Response(null, { status: 204, headers: { "Access-Control-Max-Age": "86400" } })
      );
    }

    const url = new URL(req.url);
    let route = pathRoute(url);
    if (!["/ping", "/login", "/getprogress", "/recordkpi", "/log"].includes(route)) {
      const byAction = actionRoute(url);
      if (byAction) route = byAction;
    }

    try {
      let res: Response;
      if (route === "/ping")            res = await handlePing();
      else if (route === "/login")      res = await handleLogin(env, url);
      else if (route === "/getprogress")res = await handleGetProgress(env, req, url);
      else if (route === "/recordkpi")  res = await handleRecordKPI(env, url);
      else if (route === "/log")        res = await handleLog(env, url);
      else                              res = err("Invalid action", 400);

      return withCORS(env, res);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Internal error";
      return withCORS(env, jsonResp({ success: false, message: msg }, { status: 500 }));
    }
  },
};
