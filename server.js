const mysql = require("mysql2/promise");

console.log(">>> SERVER.JS HACK-ME 4100 LANCÉ <<<");

const express = require("express");
const app = express();

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
      res.send("Connexion réussie ! (mais vulnérable 😈)");
    } else {
      res.send("Identifiants incorrects");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la connexion");
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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});