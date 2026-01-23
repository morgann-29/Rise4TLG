from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, admin, profile, type_profile, type_support, type_seance, work_lead_type, project, group, file, work_lead_master, session_master

app = FastAPI(
    title="Starter API",
    description="API avec authentification multi-profil",
    version="1.0.0"
)

# CORS - Adapter selon vos domaines
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.151:3000",  # Accès réseau local
        # Ajouter votre domaine Vercel ici
        # "https://your-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Routers - Authentification
app.include_router(auth.router)

# Routers - Administration
app.include_router(admin.router)

# Routers - Profils
app.include_router(profile.router)
app.include_router(type_profile.router)

# Routers - Types (reference tables)
app.include_router(type_support.router)
app.include_router(type_seance.router)
app.include_router(work_lead_type.router)

# Routers - Metier
app.include_router(project.router)
app.include_router(group.router)
app.include_router(work_lead_master.router)
app.include_router(session_master.router)

# Routers - Fichiers
app.include_router(file.router)

# TODO: Ajouter vos routers metier ici
# from app.routers import your_router
# app.include_router(your_router.router)


@app.get("/")
def root():
    return {
        "message": "API operationnelle",
        "version": "1.0.0",
        "auth": "enabled"
    }


@app.get("/health")
def health():
    return {"status": "ok", "auth": "enabled"}
