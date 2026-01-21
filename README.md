# Starter Template - FastAPI + React + Supabase

Template de demarrage pour applications SaaS avec authentification multi-profil.

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 19, React Router 7, TailwindCSS |
| Backend | Python, FastAPI |
| Base de donnees | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| Styling | TailwindCSS avec dark mode |

## Fonctionnalites incluses

- **Authentification Supabase** : Login, logout, reset password
- **Multi-profil** : Un utilisateur peut avoir plusieurs profils (admin, operator, etc.)
- **Switch de profil** : Changement de profil sans deconnexion
- **Admin interface** : Gestion des utilisateurs et profils
- **Invite-only** : Creation d'utilisateurs par admin uniquement
- **Dark mode** : Support complet du theme sombre
- **RLS** : Row Level Security configuree (deny all, backend only)

## Structure du Projet

```
starter-template/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── contexts/        # AuthContext, ThemeContext
│   │   ├── services/        # API, auth, profile, admin services
│   │   ├── components/      # Layout, AdminLayout, Logo
│   │   └── pages/           # Login, Dashboard, Users, etc.
│   └── package.json
├── backend/                  # API FastAPI
│   ├── app/
│   │   ├── main.py          # Point d'entree FastAPI
│   │   ├── config.py        # Configuration Supabase
│   │   ├── auth.py          # Authentification JWT
│   │   ├── models/          # Modeles Pydantic
│   │   └── routers/         # Endpoints API
│   └── requirements.txt
└── scripts/                  # Scripts SQL
    ├── 001_create_tables.sql
    ├── 002_enable_rls.sql
    └── 003_create_admin_user.sql
```

## Installation

### 1. Creer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Creez un nouveau projet
3. Notez les credentials :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` (Settings > API > service_role)

### 2. Executer les scripts SQL

Dans l'editeur SQL de Supabase, executez dans l'ordre :
1. `scripts/001_create_tables.sql` - Cree les tables
2. `scripts/002_enable_rls.sql` - Active RLS

### 3. Creer le premier admin

1. Dans Supabase Dashboard > Authentication > Users
2. Cliquez "Add user" ou "Invite user"
3. Entrez l'email de l'admin
4. Executez dans SQL Editor :
```sql
INSERT INTO profile (id_user, id_type_profil)
VALUES ('UUID_DU_USER', 1);  -- 1 = admin
```

### 4. Configurer le Backend

```bash
cd backend

# Creer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Installer les dependances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos credentials Supabase

# Lancer le serveur
uvicorn app.main:app --reload
```

Le backend est disponible sur http://localhost:8000

### 5. Configurer le Frontend

```bash
cd frontend

# Installer les dependances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos credentials Supabase

# Lancer le serveur
npm start
```

Le frontend est disponible sur http://localhost:3000

## Types de Profil

| id | nom_profil | Description |
|----|------------|-------------|
| 1  | admin | Acces a l'interface admin (`/admin/*`) |
| 2  | operator | Acces a l'interface operateur (`/dashboard`) |

## Endpoints API

### Authentication
```
POST /api/auth/login          # Connexion
POST /api/auth/logout         # Deconnexion
GET  /api/auth/me             # Utilisateur courant
POST /api/auth/refresh        # Rafraichir le token
POST /api/auth/request-password-reset  # Reset mot de passe
POST /api/auth/update-password         # Mise a jour mot de passe
```

### Profiles
```
GET  /api/profiles/my-profiles    # Mes profils
POST /api/profiles/switch/{id}    # Changer de profil
```

### Admin (admin uniquement)
```
GET    /api/admin/users           # Liste utilisateurs
POST   /api/admin/users           # Creer utilisateur
GET    /api/admin/users/{id}      # Detail utilisateur
PUT    /api/admin/users/{id}      # Modifier utilisateur
DELETE /api/admin/users/{id}      # Supprimer utilisateur
POST   /api/admin/users/{id}/resend-invite  # Renvoyer invitation
GET    /api/admin/profiles        # Liste profils
POST   /api/admin/profiles        # Creer profil
PUT    /api/admin/profiles/{id}   # Modifier profil
DELETE /api/admin/profiles/{id}   # Supprimer profil
```

### Type Profil
```
GET    /api/type-profils          # Liste types (tous users)
GET    /api/type-profils/{id}     # Detail type
POST   /api/type-profils          # Creer type (admin)
PUT    /api/type-profils/{id}     # Modifier type (admin)
DELETE /api/type-profils/{id}     # Supprimer type (admin)
```

## Personnalisation

### Ajouter vos pages metier

1. Creer une page dans `frontend/src/pages/`
2. Ajouter la route dans `frontend/src/App.js`
3. Ajouter le lien dans `frontend/src/components/Layout.js`

### Ajouter vos endpoints API

1. Creer un router dans `backend/app/routers/`
2. L'inclure dans `backend/app/main.py`
3. Creer les modeles Pydantic dans `backend/app/models/`

### Ajouter vos tables

1. Creer un script SQL dans `scripts/`
2. Ajouter la policy RLS "deny all"
3. Creer le router correspondant

## Deploiement

### Frontend (Vercel)
- Root Directory: `frontend`
- Variables d'environnement a configurer :
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - `REACT_APP_API_URL` (URL du backend)
  - `CI=false` (ignore les warnings ESLint)

### Backend (Render)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Variables d'environnement a configurer :
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`

### CORS

N'oubliez pas d'ajouter votre domaine Vercel dans `backend/app/main.py` :

```python
allow_origins=[
    "http://localhost:3000",
    "https://your-app.vercel.app",
]
```

## Logos

Placez vos logos dans `frontend/public/` :
- `logo-light.png` - Pour le theme clair
- `logo-dark.png` - Pour le theme sombre

## License

MIT
