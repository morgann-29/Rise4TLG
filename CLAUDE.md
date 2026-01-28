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
    auth.py          # Helpers auth (get_current_user, require_admin, require_super_coach, require_coach, require_navigant)
    config.py        # Settings (SUPABASE_URL, clés)
    models/          # Pydantic schemas
      file.py        # Files et références (+ ProcessingStatus enum)
      group.py       # Groupes et détails
      project.py     # Projets
      type_seance.py # Types de séances
      type_support.py # Types de support
      work_lead_type.py # Types d'axes de travail
      work_lead_master.py # Modèles d'axes de travail
      session_master.py # Modèles de séances
      period.py      # Périodes (period_master et period)
    services/        # Services métier
      media_processor.py # Compression images/vidéos, génération thumbnails (Pillow, FFmpeg)
    routers/         # Endpoints API
      file.py        # Upload, partage, suppression fichiers (+ traitement média async)
      group.py       # CRUD groupes + gestion coachs/projets
      project.py     # CRUD projets
      type_seance.py # CRUD types séances
      type_support.py # CRUD types support
      work_lead_type.py # CRUD types axes
      work_lead_master.py # CRUD modèles axes
      session_master.py # CRUD modèles séances
      coach.py       # API Coach (groupes, sessions, work leads)
      navigant.py    # API Navigant (projet, sessions, work leads)
frontend/
  src/
    components/
      AdminLayout.js      # Layout admin
      SuperCoachLayout.js # Layout super coach
      CoachLayout.js      # Layout coach (menus dynamiques par groupe)
      NavigantLayout.js   # Layout navigant (menu projet avec sections)
      ContentEditor/      # Wrapper RichTextEditor avec edit/view mode + autosave
      FileManager/        # Gestion upload/liste fichiers
      RichTextEditor/     # Editeur TipTap avec médias
      LocationPicker/     # Carte Leaflet pour selection de lieu
      shared/             # Composants partagés (ConfirmModal)
    contexts/        # AuthContext, ThemeContext
    pages/
      admin/               # Pages Admin
        AdminDashboard.js, Users.js
        TypeSupports.js, TypeSeances.js, TypeWorkLeads.js
      super-coach/         # Pages Super Coach
        SuperCoachDashboard.js
        Projects.js, ProjectDetails.js
        Groups.js, GroupDetails.js
        WorkLeadMasterModels.js, WorkLeadMasterModelDetail.js
        SessionMasterModels.js, SessionMasterModelDetail.js
      coach/               # Pages Coach
        CoachDashboard.js, GroupProgrammation.js
        GroupSessions.js, GroupSessionDetail.js
        GroupWorkLeads.js, GroupWorkLeadDetail.js
        GroupProjects.js, GroupProjectDetail.js
        GroupPeriods.js, GroupPeriodDetail.js
      navigant/            # Pages Navigant
        NavigantDashboard.js
      shared/              # Pages multi-rôles (layout-agnostic)
        SessionDetail.js, WorkLeadDetail.js, PeriodDetail.js
        ProjectSessions.js, ProjectWorkLeads.js, ProjectPeriods.js  # CRUD complet pour Coach et Navigant
    services/
      api.js              # Config Axios
      adminService.js     # API admin
      fileService.js      # API fichiers
      groupService.js     # API groupes
      projectService.js   # API projets
      workLeadMasterService.js # API modèles axes
      sessionMasterService.js # API modèles séances
      coachService.js    # API coach (groupes, sessions, work leads)
      navigantService.js # API navigant (projet, sessions, work leads)
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
    +-----> work_lead -----> work_lead_type (avec parent_id optionnel pour sous-catégories)
    |
    +-----> project_session_master (pivot) -----> session_master (sessions de groupe)
    |                                                  |
    v (project_id)                                     v
session -----> session_master              session_master_work_lead_master
    |                                                  |
    v                                                  v
session_work_lead                           work_lead_master (modèles/templates)
    |
    v
work_lead

period -----> period_master (périodes de groupe)
    |              |
    v              v
project         group

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
| Coach | 3 | CRUD sur ses groupes assignés + sessions/axes des projets du groupe |
| Navigant | 4 | Accès à ses projets (peut en avoir plusieurs) |

## Conventions

- **Backend**: snake_case (Python, SQL)
- **Frontend**: camelCase (JS), mais les données API restent en snake_case
- **Tables ref**: `type_*` avec INTEGER id auto-increment
- **Tables metier**: UUID pour les id
- **Soft delete**: champ `is_deleted` (boolean, default false)
- **Archivage**: champ `is_archived` (boolean) pour work_lead_master et work_lead
- **Hiérarchie work_lead_type**: `parent_id` (UUID nullable) pour créer des sous-catégories. **Un seul niveau** autorisé (parent → enfant, pas plus). Les types parents et enfants peuvent tous deux être assignés aux work_leads. Affichage frontend: `{parent_name} - {name}`
- **Status work_lead**: le statut est stocké dans les tables pivots (`session_master_work_lead_master`, `session_work_lead`) avec enum (TODO, WORKING, DANGER, OK). Le `current_status` est calculé : pas d'entrée pivot = NEW, sinon = statut de l'entrée la plus récente
- **Override master**: `session_work_lead.override_master` (BOOLEAN nullable) contrôle la synchronisation:
  - `NULL` = work_lead créé directement (pas de master), pas de synchro
  - `FALSE` = lié au master, synchronise le status automatiquement
  - `TRUE` = personnalisé localement, pas de synchro

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
- `GET /api/coach/groups/{id}/sessions/{session_id}/work-lead-masters` - Thématiques de la session
- `PUT /api/coach/groups/{id}/sessions/{session_id}/work-lead-masters` - Associer/modifier thématique (status null = supprimer)
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/work-leads` - Axes de travail du groupe
- `GET /api/coach/groups/{id}/work-leads/{work_lead_id}` - Détail axe
- `GET /api/coach/groups/{id}/work-leads/{work_lead_id}/sessions` - Historique sessions où l'axe a été utilisé (paginé)
- `POST /api/coach/groups/{id}/work-leads/{work_lead_id}/archive` - Archiver axe
- `POST /api/coach/groups/{id}/work-leads/{work_lead_id}/unarchive` - Désarchiver axe
- `POST /api/coach/groups/{id}/work-leads/{work_lead_id}/restore` - Restaurer axe supprimé
- `GET /api/coach/groups/{id}/projects` - Projets du groupe
- `GET /api/coach/groups/{id}/projects/{project_id}` - Détail projet avec compteurs sessions/axes
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/projects/{project_id}/sessions` - Sessions du projet
- `GET /api/coach/groups/{id}/projects/{project_id}/sessions/{session_id}/detail` - Session complète (session_master, équipage, work_leads)
- `GET /api/coach/groups/{id}/projects/{project_id}/sessions/{session_id}/work-leads` - Work leads de la session
- `PUT /api/coach/groups/{id}/projects/{project_id}/sessions/{session_id}/work-leads/{work_lead_id}` - Modifier status work lead (status null = supprimer)
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/projects/{project_id}/work-leads` - Axes de travail du projet
- `GET /api/coach/groups/{id}/projects/{project_id}/work-leads/{work_lead_id}` - Détail axe projet
- `GET /api/coach/groups/{id}/projects/{project_id}/work-leads/{work_lead_id}/sessions` - Historique sessions axe projet (paginé)
- `POST /api/coach/groups/{id}/projects/{project_id}/work-leads/{work_lead_id}/archive` - Archiver axe projet
- `POST /api/coach/groups/{id}/projects/{project_id}/work-leads/{work_lead_id}/unarchive` - Désarchiver axe projet
- `POST /api/coach/groups/{id}/projects/{project_id}/work-leads/{work_lead_id}/restore` - Restaurer axe projet supprimé
- `POST /api/coach/groups/{id}/work-leads/import` - Importer un modèle d'axe dans le groupe
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/periods` - Périodes du groupe (period_master)
- `GET /api/coach/groups/{id}/periods/{period_id}` - Détail période groupe
- `PUT /api/coach/groups/{id}/periods/{period_id}/participants` - Modifier projets participants
- `GET /api/coach/groups/{id}/periods/{period_id}/session-masters` - Sessions dans la période
- `GET/POST/PUT/DELETE /api/coach/groups/{id}/projects/{project_id}/periods` - Périodes du projet
- `GET /api/coach/groups/{id}/projects/{project_id}/periods/{period_id}` - Détail période projet
- `GET /api/coach/groups/{id}/projects/{project_id}/periods/{period_id}/sessions` - Sessions dans la période
- `GET /api/coach/type-seances` - Types de séances pour dropdown
- `GET /api/coach/work-lead-types` - Types d'axes pour dropdown
- `GET /api/coach/work-lead-models` - Modèles d'axes disponibles pour import

### Navigant (type_profile_id = 4)
- `GET /api/navigant/projects` - Liste tous mes projets
- `GET /api/navigant/projects/{project_id}/sessions` - Sessions du projet
- `POST /api/navigant/projects/{project_id}/sessions` - Créer session
- `GET /api/navigant/projects/{project_id}/sessions/{session_id}` - Détail session basique
- `PUT /api/navigant/projects/{project_id}/sessions/{session_id}` - Modifier session
- `DELETE /api/navigant/projects/{project_id}/sessions/{session_id}` - Supprimer session
- `GET /api/navigant/projects/{project_id}/sessions/{session_id}/detail` - Session complète (session_master, équipage, work_leads)
- `GET /api/navigant/projects/{project_id}/sessions/{session_id}/work-leads` - Work leads associés à la session
- `PUT /api/navigant/projects/{project_id}/sessions/{session_id}/work-leads/{work_lead_id}` - Modifier status work lead session (status null = supprimer)
- `GET /api/navigant/projects/{project_id}/work-leads` - Axes de travail du projet
- `POST /api/navigant/projects/{project_id}/work-leads` - Créer axe
- `GET /api/navigant/projects/{project_id}/work-leads/{work_lead_id}` - Détail axe
- `GET /api/navigant/projects/{project_id}/work-leads/{work_lead_id}/sessions` - Historique sessions axe (paginé)
- `PUT /api/navigant/projects/{project_id}/work-leads/{work_lead_id}` - Modifier axe
- `DELETE /api/navigant/projects/{project_id}/work-leads/{work_lead_id}` - Supprimer axe
- `POST /api/navigant/projects/{project_id}/work-leads/{work_lead_id}/archive` - Archiver axe
- `POST /api/navigant/projects/{project_id}/work-leads/{work_lead_id}/unarchive` - Désarchiver axe
- `POST /api/navigant/projects/{project_id}/work-leads/{work_lead_id}/restore` - Restaurer axe supprimé
- `GET/POST/PUT/DELETE /api/navigant/projects/{project_id}/periods` - Périodes du projet
- `GET /api/navigant/projects/{project_id}/periods/{period_id}` - Détail période
- `GET /api/navigant/projects/{project_id}/periods/{period_id}/sessions` - Sessions dans la période
- `POST /api/navigant/projects/{project_id}/periods/{period_id}/restore` - Restaurer période supprimée
- `GET /api/navigant/type-seances` - Types de séances pour dropdown
- `GET /api/navigant/work-lead-types` - Types d'axes pour dropdown

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
- project, group, session, session_master, work_lead, work_lead_master, profile, period, period_master

**Types de contenu** (FileType):
- image, document, video, audio, gps_track, weather_data, other

**Fonctionnement:**
- Upload vers Supabase Storage avec signed URLs
- Fichiers sources vs références (partage sans duplication)
- Suppression intelligente: source supprime aussi les références
- URLs signées avec expiration, rafraîchissables via `/resolve-urls`

**Traitement média (compression & thumbnails):**
- **Images** : compression client-side via `browser-image-compression` (max 2MB, 1920px, JPEG 80%), puis thumbnail backend 400x400 via Pillow
- **Vidéos** : upload direct, puis compression async backend via FFmpeg (H.264, max 1080p, CRF 23) + extraction thumbnail à 1s
- **Statut de traitement** : `processing_status` enum (ready, pending, processing, failed)
- **Champs DB** : `thumbnail_path`, `processing_status`, `processing_error`, `original_file_size`
- **UI** : spinner pendant le traitement, polling auto toutes les 5s, badge erreur si échec
- **Prérequis serveur** : FFmpeg installé et dans le PATH

## Composants Frontend clés

### ContentEditor
- Wrapper autour de RichTextEditor avec mode édition/lecture
- Toggle "Modifier" / "Fermer" pour basculer entre les modes
- Autosave avec debounce configurable (défaut: 3 secondes)
- Indicateurs de statut visuels (sauvegarde en cours, sauvegardé, erreur, modifications non sauvegardées)
- Sauvegarde manuelle avec bouton "Sauvegarder"
- Sauvegarde automatique au passage en mode lecture si modifications

### RichTextEditor
- Basé sur TipTap (StarterKit, Image, Link, Placeholder)
- MediaPicker pour insérer images depuis FileManager
- Résolution automatique des URLs signées à l'affichage
- Support dynamique du mode readOnly via setEditable()

### FileManager (`FileManager/`)
Architecture en 3 composants :
- **FileGrid** (`FileGrid.js`) - Composant de présentation pur : grille/liste de fichiers, fullscreen modal (images/vidéos), pagination (pages classiques, 20/50/100 par page), téléchargement, ouverture PDF/nouvel onglet. Affiche thumbnails en grille, full-size en fullscreen. Indicateur de traitement (spinner) et badge erreur. Props : `files, total, offset, limit, onPageChange, onLimitChange, viewMode, readOnly, onDelete, renderFileActions`
- **FileManager** (`index.js`) - Upload drag & drop (avec compression auto des images), suppression avec confirmation, polling auto toutes les 5s quand des fichiers sont en traitement. Props notables : `refreshTrigger` (incrémenter pour forcer le rechargement), `entityType`, `entityId`, `readOnly`
- **MasterFilesSection** (`MasterFilesSection.js`) - Section collapsible pour les fichiers d'une entité master (session_master, period_master). Affiche les fichiers master avec bouton "Associer" et badge "Ajouté" pour les fichiers déjà partagés. Utilise FileGrid en interne. Props : `masterEntityType, masterEntityId, targetEntityType, targetEntityId, onFileShared`

**Pagination backend** : `GET /api/files/{entity_type}/{entity_id}?offset=0&limit=20` retourne `{items, total, offset, limit}`. Limit max: 100. Sources d'abord, puis références, triés par `created_at DESC`.

**fileService helpers** : `compressImage(file)`, `isProcessing(file)`, `isProcessingFailed(file)`, `getDisplayUrl(file)` (retourne thumbnail_url ou signed_url)

### LocationPicker
- Carte Leaflet (OpenStreetMap)
- Centre par defaut: 47.68, -3.40 (Bretagne)
- Clic pour placer un marqueur
- Affichage coordonnees lat/lng

### Layouts
- `AdminLayout` - Navigation admin (Users, Types référentiels)
- `SuperCoachLayout` - Navigation super coach (Dashboard, Projects, Groups, Models)
- `CoachLayout` - Navigation coach avec menus dynamiques par groupe assigné
- `NavigantLayout` - Navigation navigant (Dashboard, Mes Projets avec sous-menus Séances/Axes par projet)

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
/coach/groups/:groupId/projects/:projectId
/coach/groups/:groupId/projects/:projectId/sessions
/coach/groups/:groupId/projects/:projectId/sessions/:sessionId
/coach/groups/:groupId/projects/:projectId/work-leads
/coach/groups/:groupId/projects/:projectId/work-leads/:workLeadId
/coach/groups/:groupId/projects/:projectId/periods
/coach/groups/:groupId/projects/:projectId/periods/:periodId
/coach/groups/:groupId/periods
/coach/groups/:groupId/periods/:periodId
/navigant
/navigant/projects/:projectId/sessions
/navigant/projects/:projectId/sessions/:sessionId
/navigant/projects/:projectId/work-leads
/navigant/projects/:projectId/work-leads/:workLeadId
/navigant/projects/:projectId/periods
/navigant/projects/:projectId/periods/:periodId
```

## Notes techniques

- RLS activé sur toutes les tables (policies dans schema.sql)
- Le backend utilise la clé service_role pour bypasser RLS
- Frontend stocke le token dans localStorage
- Dark mode supporté (ThemeContext)
- Triggers auto `updated_at` sur toutes les tables
- Trigger `check_project_owner_is_navigant()` - Projets doivent appartenir à Navigant
- Trigger `check_session_master_coach_is_coach()` - Coach session doit être Coach
- Les réponses API work_lead incluent `work_lead_type_parent_id` et `work_lead_type_parent_name` pour l'affichage hiérarchique

## Flux creation de seance (Coach)

Quand un Coach cree une seance pour un groupe:
1. Creation `session_master` (seance groupe)
2. Pour chaque projet selectionne:
   - Creation `project_session_master` (pivot)
   - Creation `session` (seance individuelle liee au projet)
   - Creation `session_profile` (equipage = navigant du projet)

Les sessions individuelles heritent: nom, type, dates, location de la session_master.

## Flux propagation des thematiques (work_lead_master -> work_lead)

Quand un Coach associe un work_lead_master a une session_master:
1. Upsert dans `session_master_work_lead_master` (status + profile_id)
2. Pour chaque projet lie a la session_master (via session.session_master_id):
   - Cherche un `work_lead` existant (work_lead.work_lead_master_id = ce master, inclut archives)
   - Si non trouve: cree le `work_lead` (copie name, content, work_lead_type_id) + partage fichiers via `files_reference`
   - Upsert dans `session_work_lead`:
     - Nouvelle entree: `override_master = FALSE`, status = master.status
     - Entree existante + `override_master = FALSE`: sync status
     - Entree existante + `override_master = TRUE/NULL`: ignore

Quand un Coach retire un work_lead_master d'une session_master:
1. Supprime les `session_work_lead` ou `override_master = FALSE`
2. Supprime l'entree `session_master_work_lead_master`

## Flux création de période (Coach)

Quand un Coach crée une période pour un groupe:
1. Création `period_master` (période groupe) avec name, date_start, date_end
2. Pour chaque projet sélectionné:
   - Création `period` (période individuelle liée au projet)
   - Copie name, date_start, date_end depuis period_master

**Association sessions-périodes:**
- Les sessions sont associées aux périodes par date: `session.date_start BETWEEN period.date_start AND period.date_end`
- Pas de table pivot, l'association est calculée dynamiquement

**Restrictions:**
- Les périodes liées à un period_master ne peuvent pas modifier name/date_start/date_end
- Le contenu (content) et les fichiers sont indépendants entre period_master et period
- Pas d'archivage pour les périodes (juste soft delete)
