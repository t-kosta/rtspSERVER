# Deployment Guide

This guide covers various deployment scenarios for the RTSP Relay Server.

## Docker Deployment (Recommended)

### Prerequisites
- Docker 20.10+
- Docker Compose 1.29+

### Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd rtspSERVER
```

2. Configure environment (optional):
```bash
cp .env.example .env
# Edit .env if you want to customize settings
```

3. Start services:
```bash
docker-compose up -d
```

4. Check status:
```bash
docker-compose ps
docker-compose logs -f
```

5. Access the application:
- Frontend: http://localhost
- Backend API: http://localhost:3000
- RTSP Ports: 8554-8654

### Production Considerations

1. **Update credentials** in docker-compose.yml:
```yaml
environment:
  DB_PASSWORD: "your-strong-password"
  JWT_SECRET: "your-random-secret-key"
  ADMIN_PASSWORD: "your-admin-password"
```

2. **Enable SSL** using a reverse proxy (nginx/traefik)

3. **Set resource limits**:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

## Manual Deployment

### Ubuntu/Debian

1. Install dependencies:
```bash
# System packages
sudo apt-get update
sudo apt-get install -y nodejs npm postgresql ffmpeg

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Set up PostgreSQL:
```bash
sudo -u postgres psql
CREATE DATABASE rtsp_relay;
CREATE USER rtsp_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE rtsp_relay TO rtsp_user;
\q
```

3. Clone and build:
```bash
git clone <repository-url>
cd rtspSERVER

# Backend
npm install
npm run build

# Frontend
cd frontend
npm install
npm run build
```

4. Configure environment:
```bash
cp .env.example .env
nano .env
# Update with your settings
```

5. Initialize database:
```bash
npm run db:migrate
```

6. Set up systemd service:
```bash
sudo nano /etc/systemd/system/rtsp-relay.service
```

```ini
[Unit]
Description=RTSP Relay Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/rtspSERVER
ExecStart=/usr/bin/node /path/to/rtspSERVER/dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

7. Enable and start:
```bash
sudo systemctl enable rtsp-relay
sudo systemctl start rtsp-relay
sudo systemctl status rtsp-relay
```

8. Set up nginx for frontend:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/rtspSERVER/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Cloud Deployment

### AWS EC2

1. Launch EC2 instance:
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t3.xlarge or larger
   - Storage: 50GB+ SSD
   - Security groups:
     - Port 22 (SSH)
     - Port 80 (HTTP)
     - Port 443 (HTTPS)
     - Ports 8554-8654 (RTSP)

2. Install Docker:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

3. Deploy using Docker Compose (see Docker section above)

4. Configure elastic IP for static address

5. Set up Route 53 for domain management

### DigitalOcean Droplet

1. Create Droplet:
   - Image: Ubuntu 22.04
   - Plan: 4GB RAM / 2 vCPUs minimum
   - Enable monitoring

2. Follow manual deployment steps

3. Use DigitalOcean Spaces for recordings (future feature)

### Google Cloud Platform

1. Create Compute Engine instance:
   - Machine type: n2-standard-2 or larger
   - Boot disk: Ubuntu 22.04 LTS, 50GB
   - Firewall: Allow HTTP, HTTPS, RTSP ports

2. Install Docker and deploy

3. Use Cloud SQL for managed PostgreSQL (optional)

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster
- kubectl configured
- Helm 3+

### Deployment

1. Create namespace:
```bash
kubectl create namespace rtsp-relay
```

2. Create secrets:
```bash
kubectl create secret generic rtsp-relay-secrets \
  --from-literal=db-password=your-password \
  --from-literal=jwt-secret=your-secret \
  -n rtsp-relay
```

3. Deploy PostgreSQL:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: rtsp-relay
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_DB
          value: rtsp_relay
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rtsp-relay-secrets
              key: db-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

4. Deploy backend:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rtsp-relay-backend
  namespace: rtsp-relay
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rtsp-relay-backend
  template:
    metadata:
      labels:
        app: rtsp-relay-backend
    spec:
      containers:
      - name: backend
        image: your-registry/rtsp-relay-backend:latest
        env:
        - name: DB_HOST
          value: postgres
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rtsp-relay-secrets
              key: db-password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: rtsp-relay-secrets
              key: jwt-secret
        ports:
        - containerPort: 3000
        - containerPort: 8554
          protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: rtsp-relay-backend
  namespace: rtsp-relay
spec:
  selector:
    app: rtsp-relay-backend
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  - name: rtsp
    port: 8554
    targetPort: 8554
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

1. Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. Obtain certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

3. Auto-renewal is configured automatically

### Using Reverse Proxy

Example Traefik configuration:
```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - --providers.docker=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=your@email.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

## Monitoring and Logging

### Log Management

1. Configure log rotation:
```bash
sudo nano /etc/logrotate.d/rtsp-relay
```

```
/path/to/rtspSERVER/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
}
```

### Monitoring with Prometheus

Add metrics endpoint and configure Prometheus scraping.

### Health Checks

The application provides a health endpoint:
```
GET /api/health
```

Configure your load balancer to use this for health checks.

## Backup and Recovery

### Database Backup

1. Automated backup script:
```bash
#!/bin/bash
BACKUP_DIR="/backups/rtsp-relay"
DATE=$(date +%Y%m%d_%H%M%S)

pg_dump -h localhost -U rtsp_user rtsp_relay > "$BACKUP_DIR/backup_$DATE.sql"

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

2. Add to crontab:
```bash
0 2 * * * /path/to/backup-script.sh
```

### Restore from Backup

```bash
psql -h localhost -U rtsp_user -d rtsp_relay < backup_file.sql
```

## Performance Tuning

### PostgreSQL

```sql
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 4MB
```

### FFmpeg

Optimize for your hardware:
- Use hardware acceleration if available
- Adjust buffer sizes
- Tune codec parameters

### Node.js

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## Troubleshooting

### Check logs
```bash
docker-compose logs -f backend
journalctl -u rtsp-relay -f
```

### Database connection
```bash
docker-compose exec backend sh
psql -h db -U postgres -d rtsp_relay
```

### Network issues
```bash
# Test RTSP connectivity
ffplay rtsp://localhost:8554/stream-name

# Check open ports
netstat -tulpn | grep LISTEN
```
