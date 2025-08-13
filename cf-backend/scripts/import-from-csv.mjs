// scripts/import-from-csv.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseCsv } from 'csv-parse/sync';

const DATA_DIR = path.resolve('data');
const OUT_DIR  = path.resolve('migrations');
const OUT_SQL  = path.join(OUT_DIR, '0002_seed.sql');

// ---------- helpers ----------

function detectDelimiter(text) {
  const header = (text.split(/\r?\n/)[0] || '');
  return header.includes(';') ? ';' : ',';
}

function normHeader(h) {
  const s = String(h)
    .replace(/^\uFEFF/, '')     // BOM
    .replace(/\u00A0/g, ' ')    // non-breaking space
    .replace(/\s+/g, ' ')
    .trim();

  const map = {
    'id': 'id',
    'name': 'name',
    'kpi name': 'name',

    'email': 'email',
    'role': 'role',
    'active': 'active',

    'weight': 'weight',
    'category': 'category',

    'userid': 'user_id',
    'user id': 'user_id',
    'user_id': 'user_id',
    'date': 'date',
    'kpi_id': 'kpi_id',
    'kpi id': 'kpi_id',
    'completed': 'completed',
    'score': 'score'
  };

  const key = s.toLowerCase();
  return map[key] || s;
}

function readCsv(file, expectedNormalizedCols, { optionalCols = [] } = {}) {
  return fs.readFile(file, 'utf8').then(text => {
    const delimiter = detectDelimiter(text);
    const records = parseCsv(text, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      columns: header => header.map(normHeader)
    });

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error(`Файл пуст или неправильно прочитан: ${path.basename(file)}`);
    }

    const cols = Object.keys(records[0] ?? {});
    const required = expectedNormalizedCols.filter(c => !optionalCols.includes(c));
    const missing = required.filter(c => !cols.includes(c));
    if (missing.length) {
      throw new Error(`В файле ${path.basename(file)} отсутствуют колонки: ${missing.join(', ')}`);
    }

    // Добавим отсутствующие опциональные колонки как undefined,
    // дальше на этапе маппинга проставим значения по умолчанию.
    optionalCols.forEach(c => {
      if (!cols.includes(c)) {
        records.forEach(r => { r[c] = undefined; });
      }
    });

    return records;
  });
}

function toBool(v) {
  return /^(true|1|yes)$/i.test(String(v || '').trim()) ? 1 : 0;
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function sqlQuote(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ---------- main ----------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const usersCsv    = path.join(DATA_DIR, 'Users.csv');
  const kpisCsv     = path.join(DATA_DIR, 'KPIs.csv');
  const progressCsv = path.join(DATA_DIR, 'Progress.csv');

  // Users: все поля обязательны
  const users = await readCsv(usersCsv, ['id', 'name', 'email', 'role', 'active']);

  // KPIs: 'active' ДЕЛАЕМ ОПЦИОНАЛЬНЫМ
  const kpis  = await readCsv(
    kpisCsv,
    ['id', 'name', 'weight', 'category', 'active'],
    { optionalCols: ['active'] }
  );

  // Progress: все поля обязательны
  const prog  = await readCsv(progressCsv, ['user_id', 'date', 'kpi_id', 'completed', 'score']);

  const sql = [];
  sql.push('-- Seed generated from CSV');
  sql.push('BEGIN TRANSACTION;');

  // Users
  if (users.length) {
    sql.push('DELETE FROM users;');
    sql.push('INSERT INTO users (id, name, email, role, active) VALUES');
    sql.push(
      users.map(r => {
        const id     = toNum(r.id);
        const name   = sqlQuote(r.name);
        const email  = sqlQuote((r.email || '').toLowerCase());
        const role   = sqlQuote((r.role  || '').toLowerCase());
        const active = toBool(r.active);
        return `(${id}, ${name}, ${email}, ${role}, ${active})`;
      }).join(',\n') + ';'
    );
  }

  // KPIs
  if (kpis.length) {
    sql.push('DELETE FROM kpis;');
    sql.push('INSERT INTO kpis (id, name, weight, category, active) VALUES');
    sql.push(
      kpis.map(r => {
        const id       = toNum(r.id);
        const name     = sqlQuote(r.name);
        const weight   = toNum(r.weight);
        const category = sqlQuote((r.category || '').toLowerCase().replace('managment','management'));
        // если в CSV пусто или нет колонки — считаем Active=TRUE
        const active   = (r.active === undefined || r.active === '') ? 1 : toBool(r.active);
        return `(${id}, ${name}, ${weight}, ${category}, ${active})`;
      }).join(',\n') + ';'
    );
  }

  // Progress
  if (prog.length) {
    sql.push('DELETE FROM progress;');
    sql.push('INSERT INTO progress (user_id, date, kpi_id, completed, score) VALUES');
    sql.push(
      prog.map(r => {
        const uid   = toNum(r.user_id);
        const date  = sqlQuote(r.date); // YYYY-MM-DD
        const kpiId = toNum(r.kpi_id);
        const done  = toBool(r.completed);
        const score = toNum(r.score);
        return `(${uid}, ${date}, ${kpiId}, ${done}, ${score})`;
      }).join(',\n') + ';'
    );
  }

  sql.push('COMMIT;');
  await fs.writeFile(OUT_SQL, sql.join('\n') + '\n', 'utf8');
  console.log(`✅ Сид сгенерирован: ${path.relative(process.cwd(), OUT_SQL)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
