# Guide de déploiement

## Configuration GitHub Actions

### Secrets à configurer dans GitHub

Allez dans **Settings > Secrets and variables > Actions** de votre repository GitHub et ajoutez les secrets suivants :

- `VPS_HOST` : L'adresse IP ou le domaine de votre VPS (ex: `192.168.1.100` ou `vps.example.com`)
- `VPS_USER` : Le nom d'utilisateur SSH (ex: `root` ou `deploy`)
- `VPS_SSH_KEY` : La clé privée SSH pour se connecter au VPS
- `VPS_PORT` : (Optionnel) Le port SSH, par défaut 22
- `VPS_DEPLOY_PATH` : (Optionnel) Le chemin de déploiement sur le VPS, par défaut `~/TOOLS`

### Générer une clé SSH

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions
```

Copiez la clé publique sur votre VPS :
```bash
ssh-copy-id -i ~/.ssh/github_actions.pub user@vps-host
```

Ajoutez la clé privée (`~/.ssh/github_actions`) dans les secrets GitHub.

## Workflow de déploiement

Le workflow `deploy.yml` :
- Teste et build l'application
- Déploie les fichiers sur le VPS via rsync
- Build et démarre les conteneurs Docker avec docker-compose
- Effectue un health check

## Configuration du VPS

### Installation de Docker et Docker Compose

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Vérifier l'installation
docker --version
docker-compose --version
```

### Première configuration

Sur le VPS, créez le dossier de déploiement et clonez le repository :

```bash
mkdir -p ~/TOOLS
cd ~/TOOLS
git clone <votre-repo-url> .
```

### Démarrage manuel

```bash
cd ~/TOOLS
docker-compose up -d
```

### Commandes utiles

```bash
# Voir les logs
docker-compose logs -f

# Redémarrer l'application
docker-compose restart

# Arrêter l'application
docker-compose down

# Rebuild et redémarrer
docker-compose up -d --build

# Voir le statut
docker-compose ps
```

### Configuration Nginx (optionnel)

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Déploiement manuel

Si vous préférez déployer manuellement :

```bash
# Sur votre machine locale
git push origin main

# Ou manuellement sur le VPS
cd ~/TOOLS
git pull origin main
docker-compose up -d --build
```

## Développement local avec Docker

Pour tester localement avec Docker :

```bash
# Build et démarrer
docker-compose up -d --build

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

