console.log(">>> SERVER.JS HACK-ME 4100 LANCÉ <<<");

const express = require("express");
const app = express();

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

app.get("/register", (req, res) => {
  console.log(">>> ROUTE /register APPELEE <<<");
  res.sendFile(__dirname + "/views/register.html");
});

app.post("/register", (req, res) => {
  console.log("Données reçues depuis le formulaire register :", req.body);
  res.send("Inscription bien reçue !");
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});