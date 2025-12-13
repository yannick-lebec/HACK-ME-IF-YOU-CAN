# Déploiement sur Railway

## Variables d'environnement à configurer dans Railway

Dans le tableau de bord Railway, allez dans votre projet → Variables et ajoutez :

### Configuration MySQL
- `MYSQL_HOST` : L'hôte de votre base de données MySQL (ex: `containers-us-west-xxx.railway.app`)
- `MYSQL_USER` : Le nom d'utilisateur MySQL
- `MYSQL_PASSWORD` : Le mot de passe MySQL
- `MYSQL_DATABASE` : Le nom de la base de données (ex: `railway`)

### Sécurité
- `SESSION_SECRET` : Une chaîne aléatoire sécurisée pour les sessions (générez-en une avec `openssl rand -base64 32`)

### Port
- `PORT` : **Ne pas définir manuellement** - Railway fournit automatiquement cette variable

## Configuration de la base de données MySQL sur Railway

1. Dans Railway, ajoutez un service MySQL
2. Railway vous fournira automatiquement les variables d'environnement pour la connexion
3. Vous pouvez soit :
   - Utiliser ces variables directement
   - Ou créer un service MySQL séparé et référencer ses variables

## Notes importantes

- Le port est géré automatiquement par Railway via `process.env.PORT`
- Assurez-vous que votre base de données MySQL est accessible depuis Railway
- Pour le développement local, créez un fichier `.env` avec les mêmes variables (voir `.env.example` si disponible)
