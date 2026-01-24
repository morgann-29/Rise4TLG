# Rise4TLG - Context pour Claude

## Architecture

- **Frontend**: React 18 + Tailwind CSS (port 3000)
- **Backend**: FastAPI Python (port 8000)
- **BDD**: Supabase (PostgreSQL + Auth + Storage)
- **Auth**: Supabase Auth (JWT), backend valide les tokens
- **Storage**: Supabase Storage pour les fichiers (images, documents, etc.)

## Structure projet

```
backend/
  app/
    main.py          # Point d'entree FastAPI
    auth.py          # Helpers auth (get_current_user, require_admin, require_super_coach, require_coach)
    config.py        # Settings (SUPABASE_URL, clés)
    models/          # Pydantic schemas
      file.py        # Files et références
      group.py       # Groupes et détails
      project.py     # Projets
      type_seance.py # Types de séances
      type_support.py # Types de support
      work_lead_type.py # Types d'axes de travail
      work_lead_master.py # Modèles d'axes de travail
      session_master.py # Modèles de séances
    routers/         # Endpoints API
      file.py        # Upload, partage, suppression fichiers
      group.py       # CRUD groupes + gestion coachs/projets
      project.py     # CRUD projets
      type_seance.py # CRUD types séances
      type_support.py # CRUD types support
      work_lead_type.py # CRUD types axes
      work_lead_master.py # CRUD modèles axes
      session_master.py # CRUD modèles séances
      coach.py       # API Coach (groupes, sessions, work leads)
frontend/
  src/
    components/
      AdminLayout.js      # Layout admin
      SuperCoachLayout.js # Layout super coach
      CoachLayout.js      # Layout coach (menus dynamiques par groupe)
      FileManager/        # Gestion upload/liste fichiers
      RichTextEditor/     # Editeur TipTap avec médias
      shared/             # Composants partagés (ConfirmModal)
    contexts/        # AuthContext, ThemeContext
    pages/
      # Admin
      Users.js, TypeSupports.js, TypeSeances.js, TypeWorkLeads.js
      # Super Coach
      SuperCoachDashboard.js, Projects.js, ProjectDetails.js
      Groups.js, GroupDetails.js
      WorkLeadMasterModels.js, WorkLeadMasterDetail.js
      SessionMasterModels.js, SessionMasterDetail.js
      # Coach (dans pages/coach/)
      CoachDashboard.js, GroupProgrammation.js
      GroupSessions.js, GroupSessionDetail.js
      GroupWorkLeads.js, GroupWorkLeadDetail.js
      GroupProjects.js
    services/
      api.js              # Config Axios
      adminService.js     # API admin
      fileService.js      # API fichiers
      groupService.js     # API groupes
      projectService.js   # API projets
      workLeadMasterService.js # API modèles axes
      sessionMasterService.js # API modèles séances
      coachService.js    # API coach (groupes, sessions, work leads)
database/
  schema.sql         # Schema PostgreSQL complet avec RLS
  migrations/        # Scripts de migration SQL
```

## Modele de données (relations clés)

```
auth.users (Supabase)
    |
    v (user_uid)
profile -----> type_profile (Admin=1, Super Coach=2, Coach=3, Navigant=4)
    |
    +-----> group_profile (pivot) <----- group
    |                                      |
    v (profile_id)                         v
project -----> type_support           group_project (pivot)
    |
    +-----> work_lead -----> work_lead_type
    |
    v (project_id)
session -----> session_master (sessions de groupe)
    |              |
    v              v
session_work_lead  session_master_work_lead_master
    |                      |
    v                      v
work_lead           work_lead_master (modèles/templates)

files (polymorphic: entity_type + entity_id)
    |
    v
files_reference (partage de fichiers entre entités)
```

**Règles clés:**
- Un user peut avoir PLUSIEURS profils (ex: Admin + Coach)
- Contrainte: un user ne peut pas avoir 2x le même type_profile
- Un projet appartient à un Navigant (type_profile_id = 4)
- Les groupes contiennent des projets et des Coachs
- Les work_lead_master sont des templates réutilisables pour les groupes
- Les session_master avec profile_id=NULL et group_id=NULL sont des templates de séances
- Les fichiers sont polymorphiques (attachables à project, group, session, etc.)

## Rôles et permissions

| Rôle | ID | Permissions |
|------|-----|-------------|
| Admin | 1 | Accès total, gestion users, types référentiels |
| Super Coach | 2 | Gestion groupes, projets, modèles axes |
| Coach | 3 | CRUD sur ses groupes/projets assignés |
| Navigant | 4 | Accès à son projet uniquement |

## Conventions

- **Backend**: snake_case (Python, SQL)
- **Frontend**: camelCase (JS), mais les données API restent en snake_case
- **Tables ref**: `type_*` avec INTEGER id auto-increment
- **Tables metier**: UUID pour les id
- **Soft delete**: champ `is_deleted` (boolean, default false)
- **Archivage**: champ `is_archived` (boolean) pour work_lead_master et work_lead
- **Status work_lead**: enum nullable (TODO, WORKING, DANGER, OK) pour work_lead_master et work_lead

## Commandes

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm start
```

## Endpoints principaux

### Auth & Profile
- `POST /auth/login` - Connexion
- `GET /auth/me` - User courant + profils
- `GET /profile/my-profiles` - Profils du user connecté
- `POST /profile/switch/{profile_id}` - Changer profil actif

### Admin (type_profile_id = 1)
- `GET/POST /admin/users` - Liste/Créer users
- `GET/POST/PUT/DELETE /api/type-supports` - Types de support
- `GET/POST/PUT/DELETE /api/type-seances` - Types de séances (+ restore)
- `GET/POST/PUT/DELETE /api/work-lead-types` - Types d'axes de travail

### Super Coach (type_profile_id = 2)
- `GET/POST/PUT/DELETE /api/groups` - CRUD groupes
- `POST /api/groups/{id}/restore` - Restaurer groupe
- `GET /api/groups/coaches` - Liste coachs disponibles
- `POST/DELETE /api/groups/{id}/coaches/{profile_id}` - Gérer coachs du groupe
- `GET /api/groups/{id}/available-projects` - Projets non assignés
- `POST/DELETE /api/groups/{id}/projects/{project_id}` - Gérer projets du groupe
- `GET/POST/PUT/DELETE /api/projects` - CRUD projets
- `GET /api/projects/navigants` - Liste navigants disponibles
- `GET/POST/PUT/DELETE /api/work-lead-masters/models` - Modèles axes de travail
- `POST /api/work-lead-masters/models/{id}/archive` - Archiver modèle
- `POST /api/work-lead-masters/models/{id}/unarchive` - Désarchiver
- `GET/POST/PUT/DELETE /api/session-masters/models` - Modèles de séances
- `POST /api/session-masters/models/{id}/restore` - Restaurer modèle séance
- `GET /api/session-masters/type-seances` - Types de séances pour dropdown

### Coach (type_profile_id = 3)
- `GET /api/coach/groups` - Mes groupes (ceux où je suis assigné)
- `GET /api/coach/groups/{id}/basic` - Infos de base groupe (leger, pour breadcrumb)
- `GET /api/coach/groups/{id}` - Détails complets d'un groupe (avec projets)
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/sessions` - Sessions du groupe
- `GET /api/coach/groups/{id}/sessions/{session_id}` - Détail session
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/work-leads` - Axes de travail du groupe
- `GET /api/coach/groups/{id}/work-leads/{work_lead_id}` - Détail axe
- `POST /api/coach/groups/{id}/work-leads/{work_lead_id}/archive` - Archiver axe
- `POST /api/coach/groups/{id}/work-leads/{work_lead_id}/unarchive` - Désarchiver axe
- `GET /api/coach/groups/{id}/projects` - Projets du groupe (lecture seule)
- `POST /api/coach/groups/{id}/work-leads/import` - Importer un modèle d'axe dans le groupe
- `GET /api/coach/type-seances` - Types de séances pour dropdown
- `GET /api/coach/work-lead-types` - Types d'axes pour dropdown
- `GET /api/coach/work-lead-models` - Modèles d'axes disponibles pour import

### Fichiers (tous rôles avec permissions)
- `POST /api/files/upload` - Upload fichier (multipart)
- `GET /api/files/{entity_type}/{entity_id}` - Liste fichiers d'une entité
- `GET /api/files/{entity_type}/{entity_id}/images` - Images uniquement
- `GET /api/files/info/{file_id}` - Détails fichier + signed URL
- `DELETE /api/files/{file_id}` - Supprimer (smart: source vs référence)
- `POST /api/files/{file_id}/share` - Partager vers autre entité
- `POST /api/files/resolve-urls` - Rafraîchir signed URLs

## Système de fichiers

**Types de fichiers** (EntityType):
- project, group, session, session_master, work_lead, work_lead_master, profile

**Types de contenu** (FileType):
- image, document, video, audio, gps_track, weather_data, other

**Fonctionnement:**
- Upload vers Supabase Storage avec signed URLs
- Fichiers sources vs références (partage sans duplication)
- Suppression intelligente: source supprime aussi les références
- URLs signées avec expiration, rafraîchissables via `/resolve-urls`

## Composants Frontend clés

### RichTextEditor
- Basé sur TipTap (StarterKit, Image, Link, Placeholder)
- MediaPicker pour insérer images depuis FileManager
- Résolution automatique des URLs signées à l'affichage

### FileManager
- Upload drag & drop
- Liste avec preview images
- Suppression avec confirmation

### Layouts
- `AdminLayout` - Navigation admin (Users, Types référentiels)
- `SuperCoachLayout` - Navigation super coach (Dashboard, Projects, Groups, Models)
- `CoachLayout` - Navigation coach avec menus dynamiques par groupe assigné

## Routes Frontend

```
/login
/admin/users
/admin/type-supports
/admin/type-seances
/admin/type-work-leads
/super-coach
/super-coach/projects
/super-coach/projects/:id
/super-coach/groups
/super-coach/groups/:id
/super-coach/work-lead-models
/super-coach/work-lead-models/:id
/super-coach/session-models
/super-coach/session-models/:id
/coach
/coach/groups/:groupId/programmation
/coach/groups/:groupId/sessions
/coach/groups/:groupId/sessions/:sessionId
/coach/groups/:groupId/work-leads
/coach/groups/:groupId/work-leads/:workLeadId
/coach/groups/:groupId/projects
```

## Notes techniques

- RLS activé sur toutes les tables (policies dans schema.sql)
- Le backend utilise la clé service_role pour bypasser RLS
- Frontend stocke le token dans localStorage
- Dark mode supporté (ThemeContext)
- Triggers auto `updated_at` sur toutes les tables
- Trigger `check_project_owner_is_navigant()` - Projets doivent appartenir à Navigant
- Trigger `check_session_master_coach_is_coach()` - Coach session doit être Coach
