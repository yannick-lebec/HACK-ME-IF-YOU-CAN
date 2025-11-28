const mysql = require("mysql2/promise");

console.log(">>> SERVER.JS HACK-ME 4100 LANCÉ <<<");

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));


app.use(
  session({
    secret: "change-moi-plus-tard", // chaîne random à changer
    resave: false,
    saveUninitialized: false,
  })
);

// Pour que les templates (HTML) puissent savoir si on est connecté (optionnel)
app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId;
  res.locals.currentUsername = req.session.username;
  next();
});

const LEVEL1_FLAG = "FLAG{sql_injection_basic_pwned}";

const TOTAL_LEVELS = 10;

let db;

async function initDb() {
  db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "lunaetlaika",      
    database: "hackme",
  });

  console.log("✅ Connecté à MySQL");
}

initDb().catch(err => console.error(err));

app.use(express.urlencoded({ extended: true }));

const PORT = 4100;

// Page d'accueil
app.get("/", (req, res) => {
  res.send("Bienvenue sur Hack Me If You Can 😈");
});

// Page de test
app.get("/test", (req, res) => {
  console.log(">>> ROUTE /test APPELEE <<<");
  res.send("Route /test OK");
});

app.get("/game", (req, res) => {
  res.sendFile(__dirname + "/views/game.html");
});

app.get("/level1", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/views/level1.html");
});

// Page de login
app.get("/login", (req, res) => {
  console.log(">>> ROUTE /login APPELEE <<<");
  res.sendFile(__dirname + "/views/login.html");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
    const [rows] = await db.execute(query);

    if (rows.length > 0) {
  res.send(`
    <h1>🎉 BRAVO !</h1>
    <p>Tu as réussi la SQL Injection !</p>
    <p><strong>FLAG{sql_injection_basic_pwned}</strong></p>
    <a href="/game">Retour au jeu</a>
  `);
} else {
  res.send("❌ Identifiants incorrects");
}
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la connexion");
  }
});

app.post("/check-flag-level1", requireLogin, async (req, res) => {
  const { flag } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    // Par sécurité, au cas où
    return res.status(401).json({
      success: false,
      message: "Non connecté",
    });
  }

  // Mauvais flag → pas de point
  if (flag !== LEVEL1_FLAG) {
    return res.json({
      success: false,
      message: "Mauvais flag",
      level: 1,
    });
  }

  try {
    // Insertion de la progression (si pas déjà faite)
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

app.post("/reset-game", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    await db.execute("DELETE FROM user_progress WHERE user_id = ?", [userId]);
    // Optionnel : reset d'autres choses plus tard

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

app.post("/login-safe", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1) On récupère l'utilisateur par son username
    const [rows] = await db.execute(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      // Utilisateur inconnu → on revient sur /game avec un message d'erreur
      return res.redirect("/game?loginError=1");
    }

    const user = rows[0];

    // 2) Comparer le mot de passe envoyé avec le hash en BDD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Mot de passe incorrect → même traitement
      return res.redirect("/game?loginError=1");
    }

    // 3) Connexion OK → on crée la session
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

  // 1. Vérification de force du mot de passe
  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+=<>?{}[\]~]).{8,}$/;

  if (!passwordRegex.test(password)) {
    // Retour vers register-safe AVEC erreur (error=weak)
    return res.redirect("/register-safe?error=weak");
  }

  try {
    // 2. Vérifier si le nom d'utilisateur existe déjà
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      // Retour avec erreur (error=exists)
      return res.redirect("/register-safe?error=exists");
    }

    // 3. Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Insérer utilisateur
    await db.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    // 5. Récupérer user pour créer la session
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/game");
  });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login"); // si pas connecté → retour login
  }
  next();
}