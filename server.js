const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

console.log(">>> SERVER.JS HACK-ME (POSTGRES/NEON) LANCÉ <<<");

const app = express();

// === CONFIG EXPRESS / SESSIONS ===
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-moi-plus-tard",
    resave: false,
    saveUninitialized: false,
  })
);

// Pour que les templates HTML puissent savoir si on est connecté
app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId;
  res.locals.currentUsername = req.session.username;
  next();
});

// === FLAGS / CONSTANTES ===
const LEVEL1_FLAG = "FLAG{sql_injection_basic_pwned}";
const LEVEL2_FLAG = "FLAG{xss_reflected_pwned}";
const LEVEL3_FLAG = "FLAG{xss_stored_pwned}";
const LEVEL4_FLAG = "FLAG{broken_access_control_pwned}";
const LEVEL5_FLAG = "FLAG{idor_insecure_object_reference_pwned}";
const TOTAL_LEVELS = 5;

// === CONNEXION BDD (POOL POSTGRES) ===
let db = null;
let dbInitPromise = null;

async function initDb() {
  if (db) return db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquant");
  }

  // Pool global (important sur Vercel)
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  db = global.__pgPool;

  // Ping
  await db.query("SELECT 1");
  console.log("✅ PostgreSQL connecté (Neon)");

  // Tables (idempotent)
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
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      level_number INTEGER NOT NULL,
      UNIQUE(user_id, level_number)
    );
  `);

  return db;
}

async function requireDb(req, res, next) {
  try {
    if (!db) {
      if (!dbInitPromise) {
        dbInitPromise = initDb().finally(() => {
          dbInitPromise = null;
        });
      }
      await dbInitPromise;
    }
    return next();
  } catch (e) {
    console.error("❌ Erreur PostgreSQL :", e.message);
    return res
      .status(503)
      .send("Base de données indisponible (Neon en pause ?). Réessaie.");
  }
}

// === MIDDLEWARE LOGIN ===
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/game");
  next();
}

// Helper : vérifier si un joueur a déjà complété un niveau
async function hasCompletedLevel(userId, levelNumber) {
  if (!db) return false;
  const { rows } = await db.query(
    "SELECT 1 FROM user_progress WHERE user_id = $1 AND level_number = $2",
    [userId, levelNumber]
  );
  return rows.length > 0;
}

// ============================================================================
// ROUTES GÉNÉRALES
// ============================================================================
app.get("/", (req, res) => res.redirect("/game"));

app.get("/test", (req, res) => {
  console.log(">>> ROUTE /test APPELEE <<<");
  res.send("Route /test OK");
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "views/game.html"));
});

// Route debug santé DB
app.get("/health/db", async (req, res) => {
  try {
    await initDb();
    res.send("DB OK");
  } catch (e) {
    res.status(500).send("DB FAIL: " + e.message);
  }
});

// ============================================================================
// LEVEL 1 – SQL Injection
// ============================================================================
app.get("/level1", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/level1.html"));
});

app.get("/login", requireDb, async (req, res) => {
  console.log(">>> ROUTE /login APPELEE <<<");

  const loginHtmlPath = path.join(__dirname, "views/login.html");
  let htmlContent = fs.readFileSync(loginHtmlPath, "utf8");

  let showFlag = false;
  if (req.session.userId) {
    try {
      showFlag = await hasCompletedLevel(req.session.userId, 1);
      console.log(
        `>>> User ${req.session.userId} - Level 1 complété: ${showFlag}`
      );
    } catch (err) {
      console.error("Erreur lors de la vérification du level 1:", err);
    }
  }

  if (showFlag) {
    const flagSection = `
      <div style="margin-top: 24px; padding: 16px; background: rgba(0, 204, 51, 0.1); border: 2px solid #00cc33; border-radius: 12px;">
        <h2 style="color: #00cc33; margin-top: 0;">🏴 Flag Level 1</h2>
        <p style="font-size: 1.1rem; font-family: monospace; word-break: break-all;">
          <strong>${LEVEL1_FLAG}</strong>
        </p>
      </div>
    `;
    htmlContent = htmlContent.replace("</form>", "</form>" + flagSection);
  }

  res.send(htmlContent);
});

// Login vulnérable (SQLi) — version Postgres (toujours vulnérable)
app.post("/login", requireDb, async (req, res) => {
  const { username, password } = req.body;

  try {
    // ⚠️ VULNÉRABLE: interpolation directe
    const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
    const result = await db.query(query);
    const rows = result.rows;

    if (rows.length > 0) {
      req.session.level1Attempts = 0;

      return res.send(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Level 1 – Succès</title>
            <link rel="stylesheet" href="/style.css" />
          </head>
          <body class="matrix-body">
            <canvas id="matrix-canvas"></canvas>
            <div class="matrix-content">
              <h1>🎉 Bravo !</h1>
              <p>Tu as réussi à bypasser le login vulnérable via une injection SQL.</p>
              <p>Voici ton flag du Level 1 :</p>
              <p style="font-family: monospace; font-size: 1.2rem;">
                <strong>${LEVEL1_FLAG}</strong>
              </p>
              <p style="margin-top:16px;">
                Retourne sur la page <a href="/game" class="btn btn-secondary">🏠 Hub du jeu</a>
                pour coller ce flag et valider le niveau.
              </p>
            </div>

            <script>
              const canvas = document.getElementById("matrix-canvas");
              const ctx = canvas.getContext("2d");
              function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
              }
              resizeCanvas();
              const letters = "01あいうえおアイウエオネオデータハック$#@!%&<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
              const fontSize = 16;
              let columns = Math.floor(canvas.width / fontSize);
              let drops = Array(columns).fill(0);
              function draw() {
                ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#00cc33";
                ctx.font = fontSize + "px monospace";
                for (let i = 0; i < drops.length; i++) {
                  const text = letters[Math.floor(Math.random() * letters.length)];
                  ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                  if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                  }
                  drops[i]++;
                }
              }
              setInterval(draw, 75);
              window.addEventListener("resize", () => {
                resizeCanvas();
                columns = Math.floor(canvas.width / fontSize);
                drops = Array(columns).fill(0);
              });
            </script>
          </body>
        </html>
      `);
    } else {
      if (!req.session.level1Attempts) req.session.level1Attempts = 0;
      req.session.level1Attempts += 1;

      const attempts = req.session.level1Attempts;
      let redirectUrl = `/login?error=1&attempts=${attempts}`;
      if (attempts >= 3) redirectUrl += "&hint=1";

      return res.redirect(redirectUrl);
    }
  } catch (err) {
    console.error("Erreur /login vulnérable :", err);
    res.status(500).send("Erreur lors du login vulnérable");
  }
});

app.post("/check-flag-level1", requireLogin, requireDb, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (flag !== LEVEL1_FLAG) {
    return res.json({ success: false, message: "Mauvais flag", level: 1 });
  }

  try {
    await db.query(
      "INSERT INTO user_progress (user_id, level_number) VALUES ($1, $2) ON CONFLICT (user_id, level_number) DO NOTHING",
      [userId, 1]
    );

    return res.json({ success: true, message: "Bien joué !", level: 1 });
  } catch (err) {
    console.error("Erreur /check-flag-level1 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level1", requireLogin, requireDb, async (req, res) => {
  try {
    const done = await hasCompletedLevel(req.session.userId, 1);
    if (!done) {
      return res.send(`
        <h1>Explication Level 1 – SQL Injection</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level1">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }
    return res.sendFile(path.join(__dirname, "views/explain-level1.html"));
  } catch (err) {
    console.error("Erreur /explain/level1", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 2 – XSS (Reflected)
// ============================================================================
app.get("/level2", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/level2.html"));
});

app.get("/search-vuln", (req, res) => {
  const q = req.query.q || "";
  const hasScript = q.toLowerCase().includes("<script");

  if (!req.session.level2Attempts) req.session.level2Attempts = 0;
  if (q && !hasScript) req.session.level2Attempts += 1;
  if (hasScript) req.session.level2Attempts = 0;

  const attempts = req.session.level2Attempts;

  const flagBlock = hasScript
    ? `<p style="margin-top:16px">
         🎉 Bravo, tu as réussi à injecter du script côté client !<br>
         Voici ton flag du Level 2 :<br>
         <strong>${LEVEL2_FLAG}</strong>
       </p>`
    : "";

  let hintBlock = "";
  if (!hasScript && attempts >= 3) {
    hintBlock = `
      <p style="margin-top:12px; color:#eab308; font-size:0.9rem;">
        💡 Astuce : essaie d'injecter une balise
        <code>&lt;script&gt;alert('XSS')&lt;/script&gt;</code>
        ou quelque chose de similaire dans ta recherche...
      </p>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Recherche vulnérable – Level 2</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body class="matrix-body">
        <canvas id="matrix-canvas"></canvas>

        <div class="matrix-content">
          <h1>Level 2 – XSS (Reflected)</h1>
          <p class="subtitle">
            Voici un faux moteur de recherche. Essaie d'injecter du JavaScript
            en jouant avec le paramètre <code>q</code> 😈
          </p>

          <form class="search-form" method="GET" action="/search-vuln">
            <input type="text" name="q" placeholder="Tape ta recherche..." value="${q}" />
            <button type="submit" class="btn btn-secondary">Rechercher</button>
          </form>

          <h2>Résultats pour :</h2>
          <p>
            <!-- ⚠️ Injection directe, XSS possible -->
            ${q}
          </p>

          ${hintBlock}
          ${flagBlock}

          <p style="margin-top: 20px">
            <a href="/level2" class="btn btn-secondary">⬅️ Retour au brief</a>
            <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
          </p>
        </div>

        <script>
          const canvas = document.getElementById("matrix-canvas");
          const ctx = canvas.getContext("2d");
          function resizeCanvas(){ canvas.width=innerWidth; canvas.height=innerHeight; }
          resizeCanvas();
          const letters="01あいうえおアイウエオネオデータハック$#@!%&<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const fontSize=16;
          let columns=Math.floor(canvas.width/fontSize);
          let drops=Array(columns).fill(0);
          function draw(){
            ctx.fillStyle="rgba(0,0,0,0.15)";
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle="#00cc33";
            ctx.font=fontSize+"px monospace";
            for(let i=0;i<drops.length;i++){
              const text=letters[Math.floor(Math.random()*letters.length)];
              ctx.fillText(text,i*fontSize,drops[i]*fontSize);
              if(drops[i]*fontSize>canvas.height && Math.random()>0.975) drops[i]=0;
              drops[i]++;
            }
          }
          setInterval(draw,75);
          addEventListener("resize", ()=>{
            resizeCanvas();
            columns=Math.floor(canvas.width/fontSize);
            drops=Array(columns).fill(0);
          });
        </script>
      </body>
    </html>
  `);
});

app.post("/check-flag-level2", requireLogin, requireDb, async (req, res) => {
  const { flag } = req.body;
  if (flag !== LEVEL2_FLAG)
    return res.json({ success: false, message: "Mauvais flag", level: 2 });

  try {
    await db.query(
      "INSERT INTO user_progress (user_id, level_number) VALUES ($1, $2) ON CONFLICT (user_id, level_number) DO NOTHING",
      [req.session.userId, 2]
    );
    return res.json({ success: true, message: "Bien joué !", level: 2 });
  } catch (err) {
    console.error("Erreur /check-flag-level2 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level2", requireLogin, requireDb, async (req, res) => {
  try {
    const done = await hasCompletedLevel(req.session.userId, 2);
    if (!done) {
      return res.send(`
        <h1>Explication Level 2 – XSS (Reflected)</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level2">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }
    return res.sendFile(path.join(__dirname, "views/explain-level2.html"));
  } catch (err) {
    console.error("Erreur /explain/level2", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 3 – XSS (Stored)
// ============================================================================
app.get("/level3", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/level3.html"));
});

app.get("/comments-vuln", requireLogin, requireDb, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/game");

  if (!req.session.level3Attempts) req.session.level3Attempts = 0;

  try {
    const { rows } = await db.query(
      "SELECT c.content, c.created_at, u.username FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 1"
    );

    const lastComment = rows[0] || null;

    let containsScript = false;
    if (lastComment && typeof lastComment.content === "string") {
      containsScript = lastComment.content.toLowerCase().includes("<script");
    }

    if (!containsScript && lastComment) req.session.level3Attempts += 1;

    let hintBlock = "";
    if (!containsScript && req.session.level3Attempts >= 3) {
      hintBlock = `
        <p style="margin-top:12px; color:#eab308; font-size:0.9rem;">
          💡 Indice : essaie d'injecter une balise
          <code>&lt;script&gt;...&lt;/script&gt;</code>
          dans ton commentaire pour voir ce qui se passe 😈
        </p>
      `;
    }

    const commentsHtml = rows
      .map(
        (row) => `
        <div style="margin-bottom: 12px; text-align:left; max-width:600px; margin-inline:auto;">
          <div style="font-size:0.85rem; color:#9ca3af;">
            <strong>${row.username}</strong> – ${row.created_at}
          </div>
          <div>
            ${row.content}
          </div>
        </div>
      `
      )
      .join("");

    const flagBlock = containsScript
      ? `
        <div class="flag-box" style="margin-top:20px; max-width:600px; width:100%; margin-inline:auto;">
          <h2 style="margin-top:0; color:#22c55e;">🏴 Flag Level 3</h2>
          <p style="font-family:monospace; font-size:0.95rem; word-break:break-all;">
            <strong>${LEVEL3_FLAG}</strong>
          </p>
          <p style="font-size:0.85rem; color:#9ca3af; margin-top:4px;">
            Tu peux maintenant copier ce flag et le valider sur la page <strong>Game</strong> 🎯
          </p>
        </div>
      `
      : "";

    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Level 3 – XSS stocké</title>
          <link rel="stylesheet" href="/style.css" />
        </head>
        <body class="matrix-body">
          <canvas id="matrix-canvas"></canvas>

          <div class="matrix-content">
            <h1>Level 3 – XSS (Stocké)</h1>
            <p class="subtitle">
              Objectif : réussir à faire en sorte qu'un <strong>script</strong> soit stocké
              dans un commentaire… et voit ce que le serveur te révèle 😈
            </p>

            <form method="POST" action="/comments-vuln"
                  class="login-form"
                  style="flex-direction:column; max-width:600px; width:100%; margin-inline:auto;">
              <textarea
                name="content"
                rows="3"
                placeholder="Écris un commentaire... (ou un payload XSS 👀)"
                class="comment-textarea"
                required
              ></textarea>
              <button type="submit" class="btn btn-secondary" style="margin-top:8px;">
                💬 Publier
              </button>
            </form>

            ${flagBlock}

            <h2 style="margin-top:24px;">Dernier commentaire</h2>
            ${hintBlock}

            <div style="max-height:300px; overflow-y:auto; width:100%; max-width:600px; margin-inline:auto; margin-top:8px;">
              ${commentsHtml || "<p>Aucun commentaire pour l’instant.</p>"}
            </div>

            <p style="margin-top:20px;">
              <a href="/level3" class="btn btn-secondary">⬅️ Retour au brief</a>
              <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
            </p>
          </div>

          <script>
            const canvas = document.getElementById("matrix-canvas");
            const ctx = canvas.getContext("2d");
            function resizeCanvas(){canvas.width=innerWidth;canvas.height=innerHeight;}
            resizeCanvas();
            const letters="01あいうえおアイウエオネオデータハック$#@!%&<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const fontSize=16;
            let columns=Math.floor(canvas.width/fontSize);
            let drops=Array(columns).fill(0);
            function draw(){
              ctx.fillStyle="rgba(0,0,0,0.15)";
              ctx.fillRect(0,0,canvas.width,canvas.height);
              ctx.fillStyle="#00cc33";
              ctx.font=fontSize+"px monospace";
              for(let i=0;i<drops.length;i++){
                const text=letters[Math.floor(Math.random()*letters.length)];
                ctx.fillText(text,i*fontSize,drops[i]*fontSize);
                if(drops[i]*fontSize>canvas.height&&Math.random()>0.975)drops[i]=0;
                drops[i]++;
              }
            }
            setInterval(draw,75);
            onresize=()=>{resizeCanvas();columns=Math.floor(canvas.width/fontSize);drops=Array(columns).fill(0);}
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Erreur /comments-vuln :", err);
    res.status(500).send("Erreur lors de la récupération des commentaires");
  }
});

app.post("/comments-vuln", requireLogin, requireDb, async (req, res) => {
  const userId = req.session.userId;
  const { content } = req.body;

  if (!userId) return res.redirect("/game");

  try {
    if (!req.session.level3Attempts) req.session.level3Attempts = 0;
    req.session.level3Attempts += 1;

    const insert = await db.query(
      "INSERT INTO comments (user_id, content) VALUES ($1, $2) RETURNING id",
      [userId, content]
    );
    const lastId = insert.rows[0].id;

    await db.query("DELETE FROM comments WHERE id <> $1", [lastId]);

    res.redirect("/comments-vuln");
  } catch (err) {
    console.error("Erreur /comments-vuln POST :", err);
    res.status(500).send("Erreur lors de l'ajout du commentaire");
  }
});

app.post("/check-flag-level3", requireLogin, requireDb, async (req, res) => {
  const { flag } = req.body;
  if (flag !== LEVEL3_FLAG)
    return res.json({ success: false, message: "Mauvais flag", level: 3 });

  try {
    await db.query(
      "INSERT INTO user_progress (user_id, level_number) VALUES ($1, $2) ON CONFLICT (user_id, level_number) DO NOTHING",
      [req.session.userId, 3]
    );
    return res.json({ success: true, message: "Bien joué !", level: 3 });
  } catch (err) {
    console.error("Erreur /check-flag-level3 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level3", requireLogin, requireDb, async (req, res) => {
  try {
    const done = await hasCompletedLevel(req.session.userId, 3);
    if (!done) {
      return res.send(`
        <h1>Explication Level 3 – XSS (Stocké)</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level3">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }
    return res.sendFile(path.join(__dirname, "views/explain-level3.html"));
  } catch (err) {
    console.error("Erreur /explain/level3", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 4 – Broken Access Control (Admin bypass)
// ============================================================================
app.get("/level4", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/level4.html"));
});

app.get("/admin-panel", requireLogin, (req, res) => {
  const username = req.session.username;

  if (!req.session.level4Attempts) req.session.level4Attempts = 0;

  const isAdminSession = username === "admin";
  const isAdminDebug = req.query.asAdmin === "1";
  const exploited = isAdminSession || isAdminDebug;

  if (!exploited) req.session.level4Attempts += 1;

  let hintBlock = "";
  if (!exploited && req.session.level4Attempts >= 3) {
    hintBlock = `
      <p style="color:#eab308; margin-top:12px;">
        💡 Indice : essaye avec <code>?asAdmin=1</code>
      </p>
    `;
  }

  const flagBlock = exploited
    ? `
      <div class="flag-box" style="max-width:600px; margin-top:20px;">
        <h2 style="margin-top:0;">🏴 Flag Level 4</h2>
        <p><strong>${LEVEL4_FLAG}</strong></p>
        <p style="font-size:0.85rem; color:#9ca3af;">
          Copie ce flag et colle-le dans la page Game pour valider ce niveau.
        </p>
      </div>
    `
    : "";

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Zone Admin</title>
        <link rel="stylesheet" href="/style.css" />
      </head>

      <body class="matrix-body">
        <canvas id="matrix-canvas"></canvas>

        <div class="matrix-content">
          <h1>Zone Admin</h1>

          ${exploited ? `<p>Accès accordé 😈</p>` : `<p>Tu n'es pas admin. Accès refusé.</p>`}

          ${flagBlock}
          ${hintBlock}

          <p style="margin-top:20px;">
            <a href="/level4" class="btn btn-secondary">⬅️ Retour au brief</a>
            <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
          </p>
        </div>

        <script>
          const canvas=document.getElementById("matrix-canvas");
          const ctx=canvas.getContext("2d");
          function resizeCanvas(){canvas.width=innerWidth;canvas.height=innerHeight;}
          resizeCanvas();
          const letters="01あいうえおアイウエオデータハック$#@!?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const fontSize=16;
          let columns=Math.floor(canvas.width/fontSize);
          let drops=Array(columns).fill(0);
          function draw(){
            ctx.fillStyle="rgba(0,0,0,0.15)";
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle="#00cc33";
            ctx.font=fontSize+"px monospace";
            for(let i=0;i<drops.length;i++){
              const text=letters[Math.floor(Math.random()*letters.length)];
              ctx.fillText(text,i*fontSize,drops[i]*fontSize);
              if(drops[i]*fontSize>canvas.height&&Math.random()>0.975)drops[i]=0;
              drops[i]++;
            }
          }
          setInterval(draw,75);
          onresize=()=>{resizeCanvas();columns=Math.floor(canvas.width/fontSize);drops=Array(columns).fill(0);}
        </script>

      </body>
    </html>
  `);
});

app.post("/check-flag-level4", requireLogin, requireDb, async (req, res) => {
  const { flag } = req.body;
  if (flag !== LEVEL4_FLAG)
    return res.json({ success: false, message: "Mauvais flag", level: 4 });

  try {
    await db.query(
      "INSERT INTO user_progress (user_id, level_number) VALUES ($1, $2) ON CONFLICT (user_id, level_number) DO NOTHING",
      [req.session.userId, 4]
    );
    return res.json({ success: true, message: "Bien joué !", level: 4 });
  } catch (err) {
    console.error("Erreur /check-flag-level4 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level4", requireLogin, requireDb, async (req, res) => {
  try {
    const done = await hasCompletedLevel(req.session.userId, 4);
    if (!done) {
      return res.send(`
        <h1>Explication Level 4 – Broken Access Control</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level4">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }
    return res.sendFile(path.join(__dirname, "views/explain-level4.html"));
  } catch (err) {
    console.error("Erreur /explain/level4", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 5 – IDOR (Insecure Direct Object Reference)
// ============================================================================
app.get("/level5", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/level5.html"));
});

app.get("/profile-vuln", requireLogin, requireDb, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedId = req.query.id ? parseInt(req.query.id, 10) : currentUserId;

  if (!req.session.level5Attempts) req.session.level5Attempts = 0;

  try {
    const { rows } = await db.query(
      "SELECT id, username FROM users WHERE id = $1",
      [requestedId]
    );

    if (rows.length === 0) {
      req.session.level5Attempts++;

      let hint = "";
      if (req.session.level5Attempts >= 3) {
        hint = `
          <p style="color:#eab308;">
            💡 Indice : joue avec le paramètre <code>id</code> dans l'URL.
          </p>`;
      }

      return res.send(`
        <h1>Profil introuvable</h1>
        <p>Aucun utilisateur avec cet id.</p>
        <p>Essais : ${req.session.level5Attempts}</p>
        ${hint}
        <p><a href="/level5">⬅️ Retour au brief</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    const user = rows[0];
    const isOwnProfile = user.id === currentUserId;

    let flagBlock = "";

    if (!isOwnProfile) {
      req.session.level5Attempts = 0;
      flagBlock = `
        <div style="margin-top:16px; padding:12px; border-radius:8px;
                    background:#022c22; color:#bbf7d0;">
          <p>😈 Tu viens de consulter le profil de quelqu'un d'autre.</p>
          <p><strong>${LEVEL5_FLAG}</strong></p>
        </div>
      `;
    } else {
      req.session.level5Attempts++;
    }

    let hint2 = "";
    if (isOwnProfile && req.session.level5Attempts >= 5) {
      hint2 = `
        <p style="color:#eab308;">
          💡 Indice : le serveur prend un <code>id</code> depuis l'URL...
        </p>`;
    }

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Level 5 – IDOR</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body class="matrix-body">
      <canvas id="matrix-canvas"></canvas>

      <div class="matrix-content">

        <h1>Profil vulnérable</h1>
        <p class="subtitle">Essaie de voir le profil de quelqu’un d’autre…</p>

        <div style="background:rgba(15,23,42,0.9); padding:16px; border-radius:12px;">
          <p><strong>ID affiché :</strong> ${user.id}</p>
          <p><strong>Username :</strong> ${user.username}</p>
          <p style="color:#9ca3af; font-size:0.9rem;">
            (Ton id de session : <strong>${currentUserId}</strong>)
          </p>
        </div>

        ${hint2}
        ${flagBlock}

        <p style="margin-top:20px;">
          <a href="/level5" class="btn btn-secondary">⬅️ Retour au brief</a>
          <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
        </p>

      </div>

      <script>
        const canvas = document.getElementById("matrix-canvas");
        const ctx = canvas.getContext("2d");
        function resizeCanvas(){canvas.width=innerWidth;canvas.height=innerHeight;}
        resizeCanvas();
        const letters="01あいうえおアイウエオABCDE$#@!";
        const fontSize=16;
        let columns=Math.floor(canvas.width/fontSize);
        let drops=Array(columns).fill(0);
        function draw(){
          ctx.fillStyle="rgba(0,0,0,0.15)";
          ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.fillStyle="#00cc33";
          ctx.font=fontSize+"px monospace";
          for(let i=0;i<drops.length;i++){
            const text=letters[Math.floor(Math.random()*letters.length)];
            ctx.fillText(text,i*fontSize,drops[i]*fontSize);
            if(drops[i]*fontSize>canvas.height&&Math.random()>0.975)drops[i]=0;
            drops[i]++;
          }
        }
        setInterval(draw,75);
        onresize=()=>{resizeCanvas();columns=Math.floor(canvas.width/fontSize);drops=Array(columns).fill(0);}
      </script>

      </body>
      </html>
    `);
  } catch (err) {
    console.error("Erreur /profile-vuln :", err);
    res.status(500).send("Erreur lors de la récupération du profil");
  }
});

app.post("/check-flag-level5", requireLogin, requireDb, async (req, res) => {
  const { flag } = req.body;
  if (flag !== LEVEL5_FLAG)
    return res.json({ success: false, message: "Mauvais flag", level: 5 });

  try {
    await db.query(
      "INSERT INTO user_progress (user_id, level_number) VALUES ($1, $2) ON CONFLICT (user_id, level_number) DO NOTHING",
      [req.session.userId, 5]
    );
    return res.json({ success: true, message: "Bien joué !", level: 5 });
  } catch (err) {
    console.error("Erreur /check-flag-level5 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level5", requireLogin, requireDb, async (req, res) => {
  try {
    const done = await hasCompletedLevel(req.session.userId, 5);
    if (!done) {
      return res.send(`
        <h1>Explication Level 5 – IDOR</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level5">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }
    return res.sendFile(path.join(__dirname, "views/explain-level5.html"));
  } catch (err) {
    console.error("Erreur /explain/level5", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// SCORE / RESET GLOBAL
// ============================================================================
app.post("/reset-game", requireLogin, requireDb, async (req, res) => {
  try {
    await db.query("DELETE FROM user_progress WHERE user_id = $1", [
      req.session.userId,
    ]);
    res.redirect("/game");
  } catch (err) {
    console.error("Erreur /reset-game :", err);
    res.status(500).send("Erreur lors du reset du jeu");
  }
});

app.get("/score", requireLogin, requireDb, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT level_number FROM user_progress WHERE user_id = $1",
      [req.session.userId]
    );
    const completedLevels = rows.map((r) => r.level_number);

    res.json({
      username: req.session.username,
      score: completedLevels.length,
      total: TOTAL_LEVELS,
      completedLevels,
    });
  } catch (err) {
    console.error("Erreur /score :", err);
    res.status(500).json({ error: "Erreur lors de la récupération du score" });
  }
});

// ============================================================================
// LOGIN SÉCURISÉ / REGISTER SÉCURISÉ
// ============================================================================
app.post("/login-safe", requireDb, async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await db.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );

    if (rows.length === 0) return res.redirect("/game?loginError=1");

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.redirect("/game?loginError=1");

    req.session.userId = user.id;
    req.session.username = user.username;

    return res.redirect("/game");
  } catch (err) {
    console.error("Erreur login sécurisé :", err);
    res.status(500).send("Erreur lors de la connexion sécurisée");
  }
});

app.get("/register-safe", (req, res) => {
  res.sendFile(path.join(__dirname, "views/register-safe.html"));
});

app.post("/register-safe", requireDb, async (req, res) => {
  const { username, password } = req.body;

  if (username && username.length > 20) {
    return res.redirect("/register-safe?error=usernameTooLong");
  }

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+=<>?{}\[\]~]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.redirect("/register-safe?error=weak");
  }

  try {
    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existing.rows.length > 0)
      return res.redirect("/register-safe?error=exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      username,
      hashedPassword,
    ]);

    const created = await db.query(
      "SELECT id, username FROM users WHERE username = $1",
      [username]
    );
    const user = created.rows[0];

    req.session.userId = user.id;
    req.session.username = user.username;

    return res.redirect("/game");
  } catch (err) {
    console.error("Erreur /register-safe :", err);
    return res.redirect("/register-safe?error=server");
  }
});

// ============================================================================
// LOGOUT
// ============================================================================
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/game");
  });
});

// ============================================================================
// LANCEMENT SERVEUR
// ============================================================================
const PORT = process.env.PORT || 4100;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

module.exports = app;