const mysql = require("mysql2/promise");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");

console.log(">>> SERVER.JS HACK-ME 4100 LANCÉ <<<");

const app = express();

// === CONFIG EXPRESS / SESSIONS ===

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-moi-plus-tard", // à changer en prod
    resave: false,
    saveUninitialized: false,
  })
);

// Pour que les templates HTML puissent savoir si on est connecté (si tu en as besoin)
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

// === CONNEXION BDD ===

let db;

async function initDb() {
  try {
    const connectionConfig = {
      // Noms des variables de Railway (MYSQLHOST, MYSQLUSER, etc.)
      // + tes noms à toi (MYSQL_HOST, MYSQL_USER, etc.)
      host:
        process.env.MYSQLHOST ||
        process.env.MYSQL_HOST ||
        "localhost",
      port:
        process.env.MYSQLPORT ||
        process.env.MYSQL_PORT ||
        3306,
      user:
        process.env.MYSQLUSER ||
        process.env.MYSQL_USER ||
        "root",
      password:
        process.env.MYSQLPASSWORD ||
        process.env.MYSQL_PASSWORD ||
        "lunaetlaika",
      database:
        process.env.MYSQLDATABASE ||
        process.env.MYSQL_DATABASE ||
        "hackme",
    };

    db = await mysql.createConnection(connectionConfig);
    console.log(
      "✅ Connecté à MySQL sur",
      connectionConfig.host + ":" + connectionConfig.port
    );
  } catch (err) {
    console.error("❌ Impossible de se connecter à MySQL :", err.message);
    console.error(
      "❌ Le jeu démarre quand même, mais tout ce qui touche à la base ne marchera pas."
    );
    db = null;
  }
}

initDb();

const PORT = process.env.PORT || 4100;

// Helper : vérifier si un joueur a déjà complété un niveau

async function hasCompletedLevel(userId, levelNumber) {
  if (!db) return false; // si pas de DB, on dit juste "non complété"
  const [rows] = await db.execute(
    "SELECT 1 FROM user_progress WHERE user_id = ? AND level_number = ?",
    [userId, levelNumber]
  );
  return rows.length > 0;
}

// === MIDDLEWARE D'AUTHENTIFICATION ===

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/game"); // si pas connecté → retour au hub
  }
  next();
}

// ============================================================================
// ROUTES GÉNÉRALES
// ============================================================================

app.get("/", (req, res) => {
  res.redirect("/game");
});

app.get("/test", (req, res) => {
  console.log(">>> ROUTE /test APPELEE <<<");
  res.send("Route /test OK");
});

app.get("/game", (req, res) => {
  res.sendFile(__dirname + "/views/game.html");
});

// ============================================================================
// LEVEL 1 – SQL Injection
// ============================================================================

app.get("/level1", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level1.html");
});

app.get("/login", (req, res) => {
  console.log(">>> ROUTE /login APPELEE <<<");
  res.sendFile(__dirname + "/views/login.html");
});

// Login vulnérable (SQLi)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
    const [rows] = await db.execute(query);

    if (rows.length > 0) {
      req.session.level1Attempts = 0;

      return res.send(`
        <h1>🎉 BRAVO !</h1>
        <p>Tu as réussi à te connecter sur le login vulnérable.<br> copie et colle le drapeau dans la page game.</p>
        <p><strong>${LEVEL1_FLAG}</strong></p>
        <a href="/game">⬅️ Retour au jeu</a>
      `);
    } else {
      if (!req.session.level1Attempts) {
        req.session.level1Attempts = 0;
      }
      req.session.level1Attempts += 1;

      const attempts = req.session.level1Attempts;
      let redirectUrl = `/login?error=1&attempts=${attempts}`;

      if (attempts >= 5) {
        redirectUrl += "&hint=1";
      }

      return res.redirect(redirectUrl);
    }
  } catch (err) {
    console.error("Erreur /login vulnérable :", err);
    res.status(500).send("Erreur lors du login vulnérable");
  }
});

app.post("/check-flag-level1", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Non connecté",
    });
  }

  if (flag !== LEVEL1_FLAG) {
    return res.json({
      success: false,
      message: "Mauvais flag",
      level: 1,
    });
  }

  try {
    await db.execute(
      "INSERT IGNORE INTO user_progress (user_id, level_number) VALUES (?, ?)",
      [userId, 1]
    );

    return res.json({
      success: true,
      message: "Bien joué !",
      level: 1,
    });
  } catch (err) {
    console.error("Erreur /check-flag-level1 :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
});

app.get("/explain/level1", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const done = await hasCompletedLevel(userId, 1);

    if (!done) {
      return res.send(`
        <h1>Explication Level 1 – SQL Injection</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level1">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    return res.sendFile(__dirname + "/views/explain-level1.html");
  } catch (err) {
    console.error("Erreur /explain/level1 :", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 2 – XSS (Reflected)
// ============================================================================

app.get("/level2", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level2.html");
});

app.get("/search-vuln", (req, res) => {
  const q = req.query.q || "";

  const hasScript = q.toLowerCase().includes("<script");

  if (!req.session.level2Attempts) {
    req.session.level2Attempts = 0;
  }

  if (q && !hasScript) {
    req.session.level2Attempts += 1;
  }

  if (hasScript) {
    req.session.level2Attempts = 0;
  }

  const attempts = req.session.level2Attempts;

  const flagBlock = hasScript
    ? `<p style="margin-top:16px">
         🎉 Bravo, tu as réussi à injecter du script côté client !<br>
         Voici ton flag du Level 2 :<br>
         <strong>${LEVEL2_FLAG}</strong>
       </p>`
    : "";

  let hintBlock = "";
  if (!hasScript && attempts >= 5) {
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

          <form class="login-form" method="GET" action="/search-vuln">
            <input
              type="text"
              name="q"
              placeholder="Tape ta recherche..."
              value="${q}"
            />
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

        <!-- Script Matrix -->
        <script>
          const canvas = document.getElementById("matrix-canvas");
          const ctx = canvas.getContext("2d");

          function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }

          resizeCanvas();

          const letters =
            "01あいうえおアイウエオネオデータハック$#@!%&<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
});

app.post("/check-flag-level2", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (flag !== LEVEL2_FLAG) {
    return res.json({
      success: false,
      message: "Mauvais flag",
      level: 2,
    });
  }

  try {
    await db.execute(
      "INSERT IGNORE INTO user_progress (user_id, level_number) VALUES (?, ?)",
      [userId, 2]
    );

    return res.json({
      success: true,
      message: "Bien joué !",
      level: 2,
    });
  } catch (err) {
    console.error("Erreur /check-flag-level2 :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
});

app.get("/explain/level2", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const done = await hasCompletedLevel(userId, 2);

    if (!done) {
      return res.send(`
        <h1>Explication Level 2 – XSS (Reflected)</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level2">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    return res.sendFile(__dirname + "/views/explain-level2.html");
  } catch (err) {
    console.error("Erreur /explain/level2 :", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 3 – XSS (Stored)
// ============================================================================

app.get("/level3", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level3.html");
});

// Page vulnérable XSS (stored)
app.get("/comments-vuln", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/game");
  }

  if (!req.session.level3Attempts) {
    req.session.level3Attempts = 0;
  }

  try {
    const [rows] = await db.execute(
      "SELECT c.content, c.created_at, u.username FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 1"
    );

    const commentsHtml = rows
      .map(
        (row) => `
        <div style="margin-bottom: 12px; text-align:left; max-width:600px;">
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

    let hintBlock = "";
    if (req.session.level3Attempts >= 5) {
      hintBlock = `
        <p style="margin-top:12px; color:#eab308; font-size:0.9rem;">
          💡 Indice :
          <code>&lt;script&gt;alert(document.getElementById('secret-flag').dataset.flag)&lt;/script&gt;</code>
        </p>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <title>Level 3 – XSS stocké</title>
          <link rel="stylesheet" href="/style.css" />
        </head>
        <body class="matrix-body">
          <canvas id="matrix-canvas"></canvas>

          <div class="matrix-content">
            <h1>Level 3 – XSS (Stocké)</h1>
            <p class="subtitle">
              Objectif : injecter du <strong>JavaScript</strong> dans un commentaire,
              pour qu'il soit exécuté à chaque affichage de la page 😈
            </p>

            <!-- Formulaire de commentaire -->
            <form method="POST" action="/comments-vuln" class="login-form" style="flex-direction:column; max-width:600px;">
              <textarea
                name="content"
                rows="3"
                placeholder="Écris un commentaire... (ou un payload XSS 👀)"
                style="width:100%; padding:8px 12px; border-radius:12px; border:1px solid #4b5563; background:#020617; color:#e5e7eb;"
                required
              ></textarea>
              <button type="submit" class="btn btn-secondary" style="align-self:flex-start; margin-top:8px;">
                💬 Publier
              </button>
            </form>

            <!-- Flag caché dans le DOM -->
            <div
              id="secret-flag"
              data-flag="${LEVEL3_FLAG}"
              style="display:none;"
            ></div>

            <h2 style="margin-top:24px;">Commentaires</h2>
            ${hintBlock}
            <div style="max-height:300px; overflow-y:auto; width:100%; max-width:600px;">
              ${commentsHtml || "<p>Aucun commentaire pour l’instant.</p>"}
            </div>

            <p style="margin-top:20px;">
              <a href="/level3" class="btn btn-secondary">⬅️ Retour au brief</a>
              <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
            </p>
          </div>

          <!-- Script Matrix -->
          <script>
            const canvas = document.getElementById("matrix-canvas");
            const ctx = canvas.getContext("2d");

            function resizeCanvas() {
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
            }

            resizeCanvas();

            const letters =
              "01あいうえおアイウエオネオデータハック$#@!%&<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
  } catch (err) {
    console.error("Erreur /comments-vuln :", err);
    res.status(500).send("Erreur lors de la récupération des commentaires");
  }
});

app.post("/comments-vuln", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const { content } = req.body;

  if (!userId) {
    return res.redirect("/game");
  }

  try {
    // Compteur d'essais Level 3
    if (!req.session.level3Attempts) {
      req.session.level3Attempts = 0;
    }
    req.session.level3Attempts += 1;

    // ➜ On insère le nouveau commentaire
    const [result] = await db.execute(
      "INSERT INTO comments (user_id, content) VALUES (?, ?)",
      [userId, content]
    );

    const lastId = result.insertId;

    // ➜ On supprime tous les commentaires EXCEPTE celui qu’on vient d’ajouter
    await db.execute("DELETE FROM comments WHERE id <> ?", [lastId]);

    // Retour à la page vulnérable
    res.redirect("/comments-vuln");

  } catch (err) {
    console.error("Erreur /comments-vuln POST :", err);
    res.status(500).send("Erreur lors de l'ajout du commentaire");
  }
});

app.post("/check-flag-level3", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Non connecté",
    });
  }

  if (flag !== LEVEL3_FLAG) {
    return res.json({
      success: false,
      message: "Mauvais flag",
      level: 3,
    });
  }

  try {
    await db.execute(
      "INSERT IGNORE INTO user_progress (user_id, level_number) VALUES (?, ?)",
      [userId, 3]
    );

    return res.json({
      success: true,
      message: "Bien joué !",
      level: 3,
    });
  } catch (err) {
    console.error("Erreur /check-flag-level3 :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
});

app.get("/explain/level3", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const done = await hasCompletedLevel(userId, 3);

    if (!done) {
      return res.send(`
        <h1>Explication Level 3 – XSS (Stocké)</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level3">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    return res.sendFile(__dirname + "/views/explain-level3.html");
  } catch (err) {
    console.error("Erreur /explain/level3 :", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 4 – Broken Access Control (Admin bypass)
// ============================================================================

app.get("/level4", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level4.html");
});

// Faux panneau admin vulnérable
app.get("/admin-panel", requireLogin, (req, res) => {
  const username = req.session.username;

  // Init du compteur si nécessaire
  if (!req.session.level4Attempts) {
    req.session.level4Attempts = 0;
  }

  // Version censée : admin uniquement
  const isAdminSession = username === "admin";

  // Bypass debug vulnérable
  const isAdminDebug = req.query.asAdmin === "1";

  // Cas : accès refusé
  if (!isAdminSession && !isAdminDebug) {

    // INCRÉMENTATION DES ESSAIS
    req.session.level4Attempts++;

    // Construction de l'indice
    let hint = "";
    if (req.session.level4Attempts >= 5) {
      hint = `
        <p style="color:#eab308; margin-top:12px;">
          💡 Indice : admin-panel?asAdmin=1 ?
        </p>
      `;
    }

    return res.send(`
      <h1>Zone Admin</h1>
      <p>Tu n'es pas admin. Accès refusé.</p>
      <p>Essais : ${req.session.level4Attempts}</p>
      ${hint}
      <p><a href="/level4">⬅️ Retour au brief</a></p>
      <p><a href="/game">🏠 Retour au jeu</a></p>
    `);
  }

  // Cas : admin (vrai ou via bypass)
  req.session.level4Attempts = 0; // reset
  return res.send(`
    <h1>Zone Admin – Accès accordé</h1>
    <p>Bienvenue dans le faux panneau d'administration 😈</p>
    <p>Voici ton flag du Level 4 :</p>
    <p><strong>${LEVEL4_FLAG}</strong></p>

    <p style="margin-top: 20px;">
      <a href="/level4" class="btn btn-secondary">⬅️ Retour au brief</a>
      <a href="/game" class="btn btn-secondary">🏠 Retour au jeu</a>
    </p>
  `);
});

app.post("/check-flag-level4", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Non connecté",
    });
  }

  if (flag !== LEVEL4_FLAG) {
    return res.json({
      success: false,
      message: "Mauvais flag",
      level: 4,
    });
  }

  try {
    await db.execute(
      "INSERT IGNORE INTO user_progress (user_id, level_number) VALUES (?, ?)",
      [userId, 4]
    );

    return res.json({
      success: true,
      message: "Bien joué !",
      level: 4,
    });
  } catch (err) {
    console.error("Erreur /check-flag-level4 :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
});

app.get("/explain/level4", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const done = await hasCompletedLevel(userId, 4);

    if (!done) {
      return res.send(`
        <h1>Explication Level 4 – Broken Access Control</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level4">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    return res.sendFile(__dirname + "/views/explain-level4.html");
  } catch (err) {
    console.error("Erreur /explain/level4 :", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// LEVEL 5 – IDOR (Insecure Direct Object Reference)
// ============================================================================

app.get("/level5", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level5.html");
});

app.get("/profile-vuln", requireLogin, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedId = req.query.id ? parseInt(req.query.id, 10) : currentUserId;

  // Compteur d'essais
  if (!req.session.level5Attempts) req.session.level5Attempts = 0;

  try {
    const [rows] = await db.execute(
      "SELECT id, username FROM users WHERE id = ?",
      [requestedId]
    );

    if (rows.length === 0) {
      req.session.level5Attempts++;

      let hint = "";
      if (req.session.level5Attempts >= 5) {
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
      // Succès → reset essais
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

app.post("/check-flag-level5", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (flag !== LEVEL5_FLAG) {
    return res.json({ success: false, message: "Mauvais flag", level: 5 });
  }

  try {
    await db.execute(
      "INSERT IGNORE INTO user_progress (user_id, level_number) VALUES (?, ?)",
      [userId, 5]
    );

    return res.json({ success: true, message: "Bien joué !", level: 5 });
  } catch (err) {
    console.error("Erreur /check-flag-level5 :", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.get("/explain/level5", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const done = await hasCompletedLevel(userId, 5);

    if (!done) {
      return res.send(`
        <h1>Explication Level 5 – IDOR</h1>
        <p>Tu dois d'abord terminer le défi avant de voir l'explication 😈</p>
        <p><a href="/level5">⬅️ Retour au niveau</a></p>
        <p><a href="/game">🏠 Retour au jeu</a></p>
      `);
    }

    return res.sendFile(__dirname + "/views/explain-level5.html");
  } catch (err) {
    console.error("Erreur /explain/level5 :", err);
    res.status(500).send("Erreur lors du chargement de l'explication");
  }
});

// ============================================================================
// SCORE / RESET GLOBAL
// ============================================================================

app.post("/reset-game", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    await db.execute("DELETE FROM user_progress WHERE user_id = ?", [userId]);
    res.redirect("/game");
  } catch (err) {
    console.error("Erreur /reset-game :", err);
    res.status(500).send("Erreur lors du reset du jeu");
  }
});

app.get("/score", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const username = req.session.username;

  if (!userId) {
    return res.status(401).json({ error: "Non connecté" });
  }

  try {
    const [rows] = await db.execute(
      "SELECT level_number FROM user_progress WHERE user_id = ?",
      [userId]
    );

    const completedLevels = rows.map((r) => r.level_number);
    const score = completedLevels.length;

    res.json({
      username,
      score,
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

app.post("/login-safe", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.redirect("/game?loginError=1");
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.redirect("/game?loginError=1");
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    return res.redirect("/game");
  } catch (err) {
    console.error("Erreur login sécurisé :", err);
    res.status(500).send("Erreur lors de la connexion sécurisée");
  }
});

app.get("/register-safe", (req, res) => {
  res.sendFile(__dirname + "/views/register-safe.html");
});

app.post("/register-safe", async (req, res) => {
  const { username, password } = req.body;

  // Vérification de force du mot de passe
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+=<>?{}\[\]~]).{8,}$/;

  if (!passwordRegex.test(password)) {
    return res.redirect("/register-safe?error=weak");
  }

  try {
    // Vérifier si le nom d'utilisateur existe déjà
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.redirect("/register-safe?error=exists");
    }

    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertion du nouvel utilisateur
    await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);

    // Récupérer le user fraichement créé
    const [rows] = await db.execute(
      "SELECT id, username FROM users WHERE username = ?",
      [username]
    );

    const user = rows[0];

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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});