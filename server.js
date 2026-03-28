require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hp-lernapp-secret-2026-bitte-aendern';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'lernapp.db');

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ── DB Setup ─────────────────────────────────────────────
let db;
async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kapitel_key TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    UNIQUE(user_id, kapitel_key)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS karten_fortschritt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    karten_id INTEGER NOT NULL,
    status TEXT DEFAULT 'neu',
    UNIQUE(user_id, karten_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS mc_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    gesamt INTEGER DEFAULT 0,
    richtig INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS notizen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    thema_id TEXT NOT NULL,
    inhalt TEXT DEFAULT '',
    UNIQUE(user_id, thema_id)
  )`);
  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function q(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function run(sql, params=[]) {
  db.run(sql, params);
  saveDB();
}
function get(sql, params=[]) { return q(sql, params)[0] || null; }

// ── Health Check (kein Auth nötig) ───────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'running' }));

// ── Auth Middleware ───────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Kein Token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch { res.status(401).json({ error: 'Token ungültig' }); }
}

// ── Auth Routes ──────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Alle Felder ausfüllen.' });
  if (password.length < 6) return res.status(400).json({ error: 'Passwort mind. 6 Zeichen.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [email.toLowerCase().trim(), hash, name.trim()]);
    const user = get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-Mail bereits registriert.' });
    res.status(500).json({ error: 'Serverfehler.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
  const user = get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/me', auth, (req, res) => {
  const user = get('SELECT id, email, name FROM users WHERE id = ?', [req.userId]);
  user ? res.json(user) : res.status(404).json({ error: 'User nicht gefunden' });
});

// ── Data Routes ──────────────────────────────────────────
app.get('/api/data', auth, (req, res) => {
  const progress = {};
  q('SELECT kapitel_key, done FROM progress WHERE user_id = ?', [req.userId])
    .forEach(r => { progress[r.kapitel_key] = r.done === 1; });

  const kartenFortschritt = {};
  q('SELECT karten_id, status FROM karten_fortschritt WHERE user_id = ?', [req.userId])
    .forEach(r => { kartenFortschritt[r.karten_id] = r.status; });

  const mcRow = get('SELECT gesamt, richtig FROM mc_stats WHERE user_id = ?', [req.userId]);
  const mcStats = mcRow || { gesamt: 0, richtig: 0 };

  const notizen = {};
  q('SELECT thema_id, inhalt FROM notizen WHERE user_id = ?', [req.userId])
    .forEach(r => { notizen[r.thema_id] = r.inhalt; });

  res.json({ progress, kartenFortschritt, mcStats, notizen });
});

app.post('/api/progress', auth, (req, res) => {
  const { kapitel_key, done } = req.body;
  run(`INSERT INTO progress (user_id, kapitel_key, done) VALUES (?, ?, ?)
    ON CONFLICT(user_id, kapitel_key) DO UPDATE SET done=excluded.done`,
    [req.userId, kapitel_key, done ? 1 : 0]);
  res.json({ ok: true });
});

app.post('/api/karten', auth, (req, res) => {
  const { karten_id, status } = req.body;
  run(`INSERT INTO karten_fortschritt (user_id, karten_id, status) VALUES (?, ?, ?)
    ON CONFLICT(user_id, karten_id) DO UPDATE SET status=excluded.status`,
    [req.userId, karten_id, status]);
  res.json({ ok: true });
});

app.post('/api/mc', auth, (req, res) => {
  const { gesamt, richtig } = req.body;
  run(`INSERT INTO mc_stats (user_id, gesamt, richtig) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET gesamt=excluded.gesamt, richtig=excluded.richtig`,
    [req.userId, gesamt, richtig]);
  res.json({ ok: true });
});

app.post('/api/notizen', auth, (req, res) => {
  const { thema_id, inhalt } = req.body;
  run(`INSERT INTO notizen (user_id, thema_id, inhalt) VALUES (?, ?, ?)
    ON CONFLICT(user_id, thema_id) DO UPDATE SET inhalt=excluded.inhalt`,
    [req.userId, thema_id, inhalt || '']);
  res.json({ ok: true });
});

app.delete('/api/reset', auth, (req, res) => {
  run('DELETE FROM progress WHERE user_id = ?', [req.userId]);
  run('DELETE FROM karten_fortschritt WHERE user_id = ?', [req.userId]);
  run('DELETE FROM mc_stats WHERE user_id = ?', [req.userId]);
  res.json({ ok: true });
});

// Catch-All nur für Nicht-API-Routen (Frontend)
if (process.env.NODE_ENV === 'production') {
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ HP-Lernapp läuft auf Port ${PORT}`);
    console.log(`📚 Datenbank: ${DB_PATH}`);
  });
});
