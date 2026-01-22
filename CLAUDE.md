# Rise4TLG - Context pour Claude

## Architecture

- **Frontend**: React 18 + Tailwind CSS (port 3000)
- **Backend**: FastAPI Python (port 8000)
- **BDD**: Supabase (PostgreSQL + Auth)
- **Auth**: Supabase Auth (JWT), backend valide les tokens

## Structure projet

```
backend/
  app/
    main.py          # Point d'entree FastAPI
    auth.py          # Helpers auth (get_current_user, require_admin)
    config.py        # Settings (SUPABASE_URL, clés)
    models/          # Pydantic schemas
    routers/         # Endpoints API
frontend/
  src/
    components/      # Composants React (Layout, AdminLayout)
    contexts/        # AuthContext, ThemeContext
    pages/           # Pages (Login, Dashboard, Users...)
    services/        # Appels API (api.js, adminService.js)
database/
  schema.sql         # Schema PostgreSQL complet avec RLS
```

## Modele de données (relations clés)

```
auth.users (Supabase)
    |
    v (user_uid)
profile -----> type_profile (Admin=1, Super Coach=2, Coach=3, Navigant=4)
    |
    v (profile_id)
project -----> type_support
    |
    v (project_id)
session -----> session_master (sessions de groupe)
    |
    v
session_work_lead <---- work_lead <---- work_lead_type
```

**Règles clés:**
- Un user peut avoir PLUSIEURS profils (ex: Admin + Coach)
- Contrainte: un user ne peut pas avoir 2x le même type_profile
- Un projet appartient à un Coach (type_profile_id = 3)
- Les groupes contiennent des projets et des Super Coachs

## Rôles et permissions

| Rôle | ID | Permissions |
|------|-----|-------------|
| Admin | 1 | Accès total, gestion users |
| Super Coach | 2 | Lecture globale |
| Coach | 3 | CRUD sur ses groupes/projets |
| Navigant | 4 | Accès à son projet uniquement |

## Conventions

- **Backend**: snake_case (Python, SQL)
- **Frontend**: camelCase (JS), mais les données API restent en snake_case
- **Tables ref**: `type_*` avec INTEGER id auto-increment
- **Tables metier**: UUID pour les id

## Commandes

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm start
```

## Endpoints principaux

- `POST /auth/login` - Connexion
- `GET /auth/me` - User courant + profils
- `GET /admin/users` - Liste users (admin only)
- `POST /admin/users` - Créer user + invite email
- `GET /profile/my-profiles` - Profils du user connecté
- `POST /profile/switch/{profile_id}` - Changer profil actif

## Notes techniques

- RLS activé sur toutes les tables (policies dans schema.sql)
- Le backend utilise la clé service_role pour bypasser RLS
- Frontend stocke le token dans localStorage
- Dark mode supporté (ThemeContext)
