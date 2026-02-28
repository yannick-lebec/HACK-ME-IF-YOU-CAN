const { Pool } = require("pg");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

console.log(">>> SERVER.JS (POSTGRES / NEON) LANCÉ <<<");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-moi-plus-tard",
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId;
  res.locals.currentUsername = req.session.username;
  next();
});

// ================= DB POSTGRES =================

let db;

async function initDb() {
  try {
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await db.query("SELECT 1");
    console.log("✅ PostgreSQL connecté (Neon)");

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        level_number INTEGER NOT NULL,
        UNIQUE(user_id, level_number)
      );
    `);

    console.log("✅ Tables PostgreSQL initialisées");
  } catch (err) {
    console.error("❌ Erreur PostgreSQL :", err.message);
    db = null;
  }
}

initDb();

function requireDb(req, res, next) {
  if (!db) return res.status(503).send("Base de données indisponible");
  next();
}

// ================= HELPERS =================

async function hasCompletedLevel(userId, levelNumber) {
  if (!db) return false;
  const { rows } = await db.query(
    "SELECT 1 FROM user_progress WHERE user_id = $1 AND level_number = $2",
    [userId, levelNumber]
  );
  return rows.length > 0;
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/game");
  next();
}

// ================= ROUTES =================

app.get("/", (req, res) => res.redirect("/game"));

app.get("/test", (req, res) => {
  res.send("Route /test OK");
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "views/game.html"));
});

// ================= AUTH SAFE =================

app.post("/login-safe", requireDb, async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await db.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );

    if (rows.length === 0)
      return res.redirect("/game?loginError=1");

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.redirect("/game?loginError=1");

    req.session.userId = user.id;
    req.session.username = user.username;

    res.redirect("/game");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur login sécurisé");
  }
});

app.get("/register-safe", (req, res) => {
  res.sendFile(path.join(__dirname, "views/register-safe.html"));
});

app.post("/register-safe", requireDb, async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (rows.length > 0)
      return res.redirect("/register-safe?error=exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, hashedPassword]
    );

    const result = await db.query(
      "SELECT id, username FROM users WHERE username = $1",
      [username]
    );

    const user = result.rows[0];

    req.session.userId = user.id;
    req.session.username = user.username;

    res.redirect("/game");
  } catch (err) {
    console.error(err);
    res.redirect("/register-safe?error=server");
  }
});

// ================= SCORE =================

app.get("/score", requireLogin, requireDb, async (req, res) => {
  const { rows } = await db.query(
    "SELECT level_number FROM user_progress WHERE user_id = $1",
    [req.session.userId]
  );

  res.json({
    username: req.session.username,
    score: rows.length,
    completedLevels: rows.map(r => r.level_number),
  });
});

// ================= LOGOUT =================

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/game"));
});

// ================= SERVERLESS =================

if (require.main === module) {
  const PORT = process.env.PORT || 4100;
  app.listen(PORT, () =>
    console.log(`Serveur démarré sur http://localhost:${PORT}`)
  );
}

module.exports = app;