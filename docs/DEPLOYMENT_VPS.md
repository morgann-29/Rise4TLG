# Guide de déploiement - VPS OVH

## Architecture cible

```
VPS OVH (Ubuntu 22.04)
├── Nginx (reverse proxy + SSL Let's Encrypt)
│   ├── app.ton-domaine.fr → Frontend React (build statique)
│   ├── api.ton-domaine.fr → FastAPI (port 8000)
│   └── supabase.ton-domaine.fr → Supabase Studio (optionnel)
└── Docker
    ├── Supabase self-hosted (PostgreSQL, Auth, Storage, etc.)
    └── FastAPI (conteneurisé ou systemd)
```

---

## 1. Configuration initiale du VPS

### 1.1 Connexion et mise à jour

```bash
ssh root@IP_DU_VPS

# Mise à jour système
apt update && apt upgrade -y

# Installer les outils essentiels
apt install -y curl git ufw fail2ban htop
```

### 1.2 Créer un utilisateur non-root

```bash
adduser deploy
usermod -aG sudo deploy

# Copier les clés SSH
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.3 Sécuriser SSH

```bash
nano /etc/ssh/sshd_config
```

Modifier :
```
PermitRootLogin no
PasswordAuthentication no
```

```bash
systemctl restart sshd
```

### 1.4 Configurer le firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 2. Installation Docker

```bash
# Se connecter en tant que deploy
su - deploy

# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Recharger le groupe (ou se reconnecter)
newgrp docker

# Vérifier
docker --version
docker-compose --version
```

---

## 3. Déploiement Supabase Self-Hosted

### 3.1 Cloner le repo Supabase

```bash
cd /home/deploy
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### 3.2 Configurer les variables d'environnement

```bash
cp .env.example .env
nano .env
```

**Variables critiques à modifier :**

```env
############
# Secrets - GÉNÉRER DES VALEURS UNIQUES !
############

# Générer avec: openssl rand -base64 32
POSTGRES_PASSWORD=ton_mot_de_passe_postgres_securise
JWT_SECRET=ton_jwt_secret_minimum_32_caracteres_genere_aleatoirement
ANON_KEY=généré_avec_supabase_cli_ou_jwt.io
SERVICE_ROLE_KEY=généré_avec_supabase_cli_ou_jwt.io

############
# URLs
############
SITE_URL=https://app.ton-domaine.fr
API_EXTERNAL_URL=https://api.ton-domaine.fr
SUPABASE_PUBLIC_URL=https://supabase.ton-domaine.fr

############
# SMTP (optionnel mais recommandé pour Auth)
############
SMTP_HOST=smtp.ton-provider.com
SMTP_PORT=587
SMTP_USER=ton_user
SMTP_PASS=ton_password
SMTP_SENDER_NAME=Rise4TLG
SMTP_ADMIN_EMAIL=admin@ton-domaine.fr
```

### 3.3 Générer les clés JWT (ANON_KEY et SERVICE_ROLE_KEY)

Option 1 - Via jwt.io :
```
# ANON_KEY payload:
{
  "role": "anon",
  "iss": "supabase",
  "iat": 1700000000,
  "exp": 2000000000
}

# SERVICE_ROLE_KEY payload:
{
  "role": "service_role",
  "iss": "supabase",
  "iat": 1700000000,
  "exp": 2000000000
}
```
Signer avec HS256 et ton JWT_SECRET.

Option 2 - Via script Node :
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'ton_jwt_secret';

const anon = jwt.sign({ role: 'anon', iss: 'supabase', iat: 1700000000, exp: 2000000000 }, JWT_SECRET);
const service = jwt.sign({ role: 'service_role', iss: 'supabase', iat: 1700000000, exp: 2000000000 }, JWT_SECRET);

console.log('ANON_KEY:', anon);
console.log('SERVICE_ROLE_KEY:', service);
```

### 3.4 Lancer Supabase

```bash
docker-compose up -d

# Vérifier que tout tourne
docker-compose ps

# Logs si problème
docker-compose logs -f
```

Services lancés :
- PostgreSQL (port 5432)
- GoTrue Auth (port 9999)
- Storage API (port 5000)
- PostgREST (port 3000)
- Supabase Studio (port 3001)
- Kong API Gateway (port 8000)

---

## 4. Déploiement du Backend FastAPI

### 4.1 Cloner le projet

```bash
cd /home/deploy
git clone https://github.com/ton-repo/Rise4TLG.git
cd Rise4TLG/backend
```

### 4.2 Option A : Avec Docker (recommandé)

Créer `backend/Dockerfile` :

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code source
COPY . .

# Port
EXPOSE 8000

# Lancement
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Créer `backend/.env` :

```env
SUPABASE_URL=http://kong:8000
SUPABASE_KEY=ta_service_role_key
SUPABASE_JWT_SECRET=ton_jwt_secret
```

Lancer :

```bash
docker build -t rise4tlg-backend .
docker run -d --name backend \
  --network supabase_default \
  -p 8001:8000 \
  --env-file .env \
  rise4tlg-backend
```

### 4.3 Option B : Avec systemd (sans Docker)

```bash
# Installer Python et venv
sudo apt install -y python3.11 python3.11-venv

# Créer l'environnement
cd /home/deploy/Rise4TLG/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Créer le service systemd :

```bash
sudo nano /etc/systemd/system/rise4tlg-backend.service
```

```ini
[Unit]
Description=Rise4TLG FastAPI Backend
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/Rise4TLG/backend
Environment="PATH=/home/deploy/Rise4TLG/backend/venv/bin"
EnvironmentFile=/home/deploy/Rise4TLG/backend/.env
ExecStart=/home/deploy/Rise4TLG/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable rise4tlg-backend
sudo systemctl start rise4tlg-backend
sudo systemctl status rise4tlg-backend
```

---

## 5. Build et déploiement du Frontend

### 5.1 Build local (recommandé)

Sur ta machine de dev :

```bash
cd frontend

# Créer .env.production
cat > .env.production << EOF
REACT_APP_API_URL=https://api.ton-domaine.fr
REACT_APP_SUPABASE_URL=https://supabase.ton-domaine.fr
REACT_APP_SUPABASE_ANON_KEY=ta_anon_key
EOF

# Build
npm run build

# Upload vers le VPS
scp -r build/* deploy@IP_VPS:/home/deploy/Rise4TLG/frontend-dist/
```

### 5.2 Ou build sur le serveur

```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

cd /home/deploy/Rise4TLG/frontend
npm ci
npm run build
mv build ../frontend-dist
```

---

## 6. Configuration Nginx + SSL

### 6.1 Installer Nginx et Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/rise4tlg
```

```nginx
# Frontend - app.ton-domaine.fr
server {
    listen 80;
    server_name app.ton-domaine.fr;

    root /home/deploy/Rise4TLG/frontend-dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# API Backend - api.ton-domaine.fr
server {
    listen 80;
    server_name api.ton-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts pour les uploads
        client_max_body_size 50M;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}

# Supabase Studio (optionnel) - supabase.ton-domaine.fr
server {
    listen 80;
    server_name supabase.ton-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Supabase Kong API - kong.ton-domaine.fr (pour Auth/Storage direct)
server {
    listen 80;
    server_name kong.ton-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 50M;
    }
}
```

### 6.3 Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/rise4tlg /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.4 SSL avec Let's Encrypt

```bash
# Configurer le DNS d'abord ! (A records vers IP du VPS)
# app.ton-domaine.fr → IP_VPS
# api.ton-domaine.fr → IP_VPS
# supabase.ton-domaine.fr → IP_VPS
# kong.ton-domaine.fr → IP_VPS

# Générer les certificats
sudo certbot --nginx -d app.ton-domaine.fr -d api.ton-domaine.fr -d supabase.ton-domaine.fr -d kong.ton-domaine.fr

# Renouvellement automatique (déjà configuré par certbot)
sudo certbot renew --dry-run
```

---

## 7. Migration des données depuis Supabase Cloud

### 7.1 Export depuis Supabase Cloud

```bash
# Sur ta machine locale avec accès à Supabase Cloud
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --no-owner \
  --no-acl \
  -F c \
  -f backup.dump
```

### 7.2 Import sur le VPS

```bash
# Copier le dump sur le VPS
scp backup.dump deploy@IP_VPS:/home/deploy/

# Sur le VPS
cd /home/deploy/supabase/docker

# Restaurer
docker-compose exec -T db pg_restore \
  -U postgres \
  -d postgres \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  < /home/deploy/backup.dump
```

### 7.3 Migration des fichiers Storage

```bash
# Option 1: Via l'API Supabase (scripts custom)
# Option 2: Export/Import manuel depuis le dashboard
# Option 3: Utiliser supabase CLI (si compatible)

# Les fichiers Storage sont dans le volume Docker:
# /home/deploy/supabase/docker/volumes/storage
```

---

## 8. Modifications du code

### 8.1 Backend - config.py

```python
# Adapter les URLs si nécessaire
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://kong:8000")  # Docker internal
# ou
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kong.ton-domaine.fr")  # External
```

### 8.2 Frontend - .env.production

```env
REACT_APP_API_URL=https://api.ton-domaine.fr
REACT_APP_SUPABASE_URL=https://kong.ton-domaine.fr
REACT_APP_SUPABASE_ANON_KEY=ta_anon_key_generee
```

---

## 9. Monitoring et maintenance

### 9.1 Logs

```bash
# Backend FastAPI
sudo journalctl -u rise4tlg-backend -f

# Supabase
cd /home/deploy/supabase/docker
docker-compose logs -f

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.2 Backups automatiques PostgreSQL

```bash
# Créer le script de backup
sudo nano /home/deploy/scripts/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

cd /home/deploy/supabase/docker
docker-compose exec -T db pg_dump -U postgres postgres | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Garder les 7 derniers backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /home/deploy/scripts/backup-db.sh

# Cron quotidien
crontab -e
# Ajouter:
0 3 * * * /home/deploy/scripts/backup-db.sh
```

### 9.3 Mise à jour de l'application

```bash
# Script de déploiement
nano /home/deploy/scripts/deploy.sh
```

```bash
#!/bin/bash
set -e

cd /home/deploy/Rise4TLG

# Pull les changements
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart rise4tlg-backend

# Frontend (si build sur serveur)
cd ../frontend
npm ci
npm run build
rm -rf ../frontend-dist/*
mv build/* ../frontend-dist/

echo "Déploiement terminé !"
```

---

## 10. Checklist de déploiement

- [ ] VPS OVH commandé et accessible en SSH
- [ ] DNS configuré (A records)
- [ ] Utilisateur `deploy` créé
- [ ] Docker installé
- [ ] Supabase self-hosted lancé
- [ ] Clés JWT générées (ANON_KEY, SERVICE_ROLE_KEY)
- [ ] Backend déployé et fonctionnel
- [ ] Frontend buildé et déployé
- [ ] Nginx configuré
- [ ] SSL Let's Encrypt activé
- [ ] Données migrées depuis Supabase Cloud
- [ ] Fichiers Storage migrés
- [ ] Backups automatiques configurés
- [ ] Tests fonctionnels passés

---

## Troubleshooting

### Supabase ne démarre pas
```bash
docker-compose logs db      # Vérifier PostgreSQL
docker-compose logs kong    # Vérifier le gateway
docker-compose down && docker-compose up -d  # Restart complet
```

### Erreur CORS
Vérifier `SITE_URL` et `API_EXTERNAL_URL` dans `.env` Supabase.

### Auth ne fonctionne pas
- Vérifier que `JWT_SECRET` est identique partout
- Vérifier que `ANON_KEY` et `SERVICE_ROLE_KEY` sont générés avec le bon secret

### Storage erreurs 403
- Vérifier les policies RLS dans Supabase Studio
- Vérifier que le bucket est public ou que les policies sont correctes

### Mémoire insuffisante
```bash
# Vérifier l'utilisation
htop
docker stats

# Désactiver les services non essentiels dans docker-compose.yml
# (ex: realtime, imgproxy si non utilisés)
```
