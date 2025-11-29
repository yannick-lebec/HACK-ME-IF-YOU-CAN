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
    secret: "change-moi-plus-tard", // à changer en prod
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
const TOTAL_LEVELS = 10;

// === CONNEXION BDD ===

let db;

async function initDb() {
  db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "lunaetlaika", // adapte si besoin
    database: "hackme",
  });

  console.log("✅ Connecté à MySQL");
}

initDb().catch((err) => console.error(err));

const PORT = 4100;

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
  res.send("Bienvenue sur Hack Me If You Can 😈");
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
        <p>Tu as réussi à te connecter sur le login vulnérable.</p>
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

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+=<>?{}[\\]~]).{8,}$/;

  if (!passwordRegex.test(password)) {
    return res.redirect("/register-safe?error=weak");
  }

  try {
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.redirect("/register-safe?error=exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);

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
// REGISTER / LOGIN VULNÉRABLES (EXTRA)
// ============================================================================

app.get("/register", (req, res) => {
  console.log(">>> ROUTE /register APPELEE <<<");
  res.sendFile(__dirname + "/views/register.html");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = `INSERT INTO users (username, password) VALUES ('${username}', '${password}')`;
    await db.execute(query);

    res.send("Utilisateur enregistré (version vulnérable 😈)");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de l'inscription");
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