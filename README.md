# 🔐 Hack Me If You Can – Web Security Challenge

Bienvenue dans Hack Me If You Can, une application volontairement vulnérable conçue pour apprendre à exploiter les failles Web les plus courantes :

SQL Injection

XSS Reflected

XSS Stored

Broken Access Control (BAC)

IDOR (Insecure Direct Object Reference)

Suivi de progression et scoreboard

Chaque niveau contient un objectif et un flag à récupérer.

## 🚀 Installation (Local)
### 1️⃣ Cloner le projet
git clone https://github.com/votre_user/hack-me-if-you-can.git
cd hack-me-if-you-can
### 2️⃣ Installer les dépendances
npm install
### 3️⃣ Configurer PostgreSQL (Neon recommandé)

Créer une base PostgreSQL (ex: via Neon).

Créer un fichier .env à la racine :

DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SESSION_SECRET=une_longue_chaine_random

⚠️ Ne pas commit .env.

### 4️⃣ Créer les tables

Exécuter ce script SQL dans PostgreSQL :

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    level_number INTEGER NOT NULL,
    UNIQUE(user_id, level_number),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
### 5️⃣ Lancer le serveur
node server.js

Accéder à l’application :

👉 http://localhost:4100

☁️ Déploiement sur Vercel

Importer le repo sur Vercel

Ajouter les variables d’environnement :

DATABASE_URL
SESSION_SECRET

Redeploy

📁 Structure du projet
hack-me-if-you-can/
 ├── server.js              # Serveur Node.js / Express
 ├── public/                # CSS, images, assets
 ├── views/                 # Pages HTML et niveaux
 │    ├── game.html
 │    ├── level1.html
 │    ├── level2.html
 │    ├── level3.html
 │    ├── level4.html
 │    ├── level5.html
 │    ├── login.html
 │    ├── register-safe.html
 │    ├── explain-level1.html
 │    ├── explain-level2.html
 │    ├── explain-level3.html
 │    ├── explain-level4.html
 │    └── explain-level5.html
 ├── package.json
 └── README.md
## 🧩 Niveaux & Objectifs
### 🧨 Level 1 – SQL Injection

Objectif : contourner le login vulnérable.

Exemple de payload :

' OR 1=1 --

Flag :

FLAG{sql_injection_basic_pwned}
### ✨ Level 2 – XSS Reflected

Objectif : injecter du JavaScript via un paramètre d’URL.

Exemple :

<script>alert(1)</script>

Flag :

FLAG{xss_reflected_pwned}
### 💣 Level 3 – XSS Stored

Objectif : injecter un script via un commentaire stocké en base.

Flag :

FLAG{xss_stored_pwned}
### 🔓 Level 4 – Broken Access Control

Objectif : accéder à une zone admin sans privilège.

Flag :

FLAG{broken_access_control_pwned}
### 🕵️ Level 5 – IDOR

Objectif : accéder au profil d’un autre utilisateur via manipulation d’ID.

Flag :

FLAG{idor_insecure_object_reference_pwned}

## 🗄️ Base de données
Table users
colonne	type
id	SERIAL PK
username	VARCHAR
password	VARCHAR
Table comments
colonne	type
id	SERIAL
user_id	INT FK
content	TEXT
created_at	TIMESTAMP
Table user_progress
colonne	type
id	SERIAL
user_id	INT FK
level_number	INT
🛡️ Notes pédagogiques

# ⚠️ Ce projet est volontairement vulnérable.

Ne jamais l’utiliser en production.

Objectif pédagogique :

comprendre les failles OWASP

apprendre les mauvaises pratiques

s’entraîner aux CTF

sensibiliser les développeurs

## 👨‍💻 Auteur

Projet créé pour l’apprentissage de la sécurité Web offensive.