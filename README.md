# 🔐 Hack Me If You Can – Web Security Challenge

Bienvenue dans **Hack Me If You Can**, une application volontairement vulnérable conçue pour apprendre à exploiter les failles Web les plus courantes :

- SQL Injection
- XSS Reflected
- XSS Stored
- Broken Access Control (BAC)
- Suivi de progression et niveau final

Chaque niveau contient un objectif et un **flag** à récupérer.

---

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre_user/hack-me-if-you-can.git
cd hack-me-if-you-can
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer MySQL

Créer la base :

```sql
CREATE DATABASE hackme;
USE hackme;
```

Importer le fichier SQL :

```bash
mysql -u root -p hackme < database.sql
```

### 4. Lancer le serveur

```bash
node server.js
```

Accéder à l’application :

👉 http://localhost:4100

---

## 📁 Structure du projet

```
hack-me-if-you-can/
 ├── server.js              # Serveur Node.js / Express
 ├── public/                # Fichiers front (CSS, images, JS)
 ├── views/                 # Pages HTML et niveaux
 │    ├── game.html
 │    ├── login.html
 │    ├── explain-level1.html
 │    ├── explain-level2.html
 │    ├── explain-level3.html
 │    ├── explain-level4.html
 │    └── explain-level5.html
 ├── database.sql           # Structure et données
 ├── package.json
 └── README.md
```

---

## 🧩 Niveaux & Objectifs

### 🧨 Level 1 – SQL Injection

Objectif : contourner le login sans connaître le mot de passe.

Payload exemple :

```
' OR 1=1 --
```

Flag : `FLAG{sql_injection_basic_pwned}`

---

### ✨ Level 2 – XSS Reflected

Objectif : injecter du JavaScript via un paramètre d’URL.

Exemple :

```html
<script>alert(1)</script>
```

Flag : `FLAG{xss_reflected_pwned}`

---

### 💣 Level 3 – XSS Stored

Objectif : poster un commentaire contenant du JavaScript qui s’exécute au rechargement.

Flag : `FLAG{xss_stored_pwned}`

---

### 🔓 Level 4 – Broken Access Control

Objectif : accéder à des pages ou actions réservées sans autorisation.

Flag : `FLAG{broken_access_control_pwned}`

---

### 🏁 Level 5 – Progression & niveau final

Objectif : valider l’ensemble des niveaux précédents et déclencher le flag final une fois la progression complétée.

Ce niveau s’appuie sur la table `user_progress` pour suivre quels niveaux ont été réussis par chaque utilisateur, et peut afficher par exemple :
- les niveaux terminés
- les flags trouvés
- un écran de fin / scoreboard

(Le comportement exact dépend de l’implémentation dans `server.js` et `views/game.html`.)

---

## 🗄️ Base de données

La base contient au minimum les tables suivantes :

### Table `users`

Représente les comptes utilisés pour se connecter à l’application.

Colonnes typiques :

| colonne   | type        | description                  |
|----------|-------------|------------------------------|
| id       | INT PK      | Identifiant utilisateur      |
| username | VARCHAR     | Nom d’utilisateur            |
| password | VARCHAR     | Mot de passe (en clair ici)  |

---

### Table `comments`

Utilisée pour les niveaux de XSS stockée (Level 3).

| colonne | type    | description                       |
|---------|---------|-----------------------------------|
| id      | INT PK  | Identifiant du commentaire        |
| user_id | INT FK  | Référence vers `users.id`         |
| content | TEXT    | Contenu du commentaire (injecté)  |

---

### Table `user_progress`

Suivi de la progression des utilisateurs sur les différents niveaux.

Colonnes typiques :

| colonne     | type    | description                                      |
|------------|---------|--------------------------------------------------|
| id         | INT PK  | Identifiant de la ligne de progression           |
| user_id    | INT FK  | Référence vers `users.id`                        |
| level      | INT     | Numéro du niveau (1 à 5)                         |
| completed  | TINYINT | 0 ou 1 : niveau terminé ou non                   |
| updated_at | DATETIME| Dernière mise à jour de la progression           |

Cette table permet :
- d’enregistrer quels niveaux ont été validés
- de débloquer le niveau 5 ou l’écran final
- de construire un tableau de bord de progression.

---

## 🛡️ Notes pédagogiques

⚠️ Ce projet est **volontairement vulnérable**.  
Ne jamais l’utiliser en production.

Idéal pour :
- apprentissage des failles OWASP
- ateliers sécurité
- challenges CTF internes
- formation développeurs

---

## 👨‍💻 Auteur

Projet créé pour s’entraîner aux attaques Web et comprendre les mauvaises pratiques.
