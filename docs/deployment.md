# Deployment Guide

Production deployment strategies and best practices for the BFF/API Middleware service.

## Production Build

### 1. Build the Application

```bash
# Install dependencies
npm ci --only=production

# Build TypeScript to JavaScript
npm run build

# Start in production mode
NODE_ENV=production npm start
```

### 2. Environment Configuration

Create a production environment file:

```bash
# .env.production
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TARGET_URL=https://api.production.com
API_PREFIX=/api
CACHE_TTL=600
CACHEABLE_METHODS=GET,POST
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  bff-proxy:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - TARGET_URL=https://api.production.com
      - CACHE_TTL=600
      - CACHEABLE_METHODS=GET,POST
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Build and Run

```bash
# Build Docker image
docker build -t bff-proxy .

# Run container
docker run -d \
  --name bff-proxy \
  -p 3000:3000 \
  -e TARGET_URL=https://api.production.com \
  -e CACHE_TTL=600 \
  bff-proxy

# Using Docker Compose
docker-compose up -d
```

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bff-proxy
  labels:
    app: bff-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bff-proxy
  template:
    metadata:
      labels:
        app: bff-proxy
    spec:
      containers:
        - name: bff-proxy
          image: bff-proxy:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3000'
            - name: HOST
              value: '0.0.0.0'
            - name: TARGET_URL
              value: 'https://api.production.com'
            - name: CACHE_TTL
              value: '600'
            - name: CACHEABLE_METHODS
              value: 'GET,POST'
          resources:
            requests:
              memory: '128Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: bff-proxy-service
spec:
  selector:
    app: bff-proxy
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bff-proxy-config
data:
  TARGET_URL: 'https://api.production.com'
  API_PREFIX: '/api'
  CACHE_TTL: '600'
  CACHEABLE_METHODS: 'GET,POST'
---
# Reference in deployment
spec:
  template:
    spec:
      containers:
        - name: bff-proxy
          envFrom:
            - configMapRef:
                name: bff-proxy-config
```

## Load Balancing

### Nginx Configuration

```nginx
upstream bff_proxy {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://bff_proxy;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Multiple Instances

```bash
# Instance 1
PORT=3000 TARGET_URL=https://api.production.com npm start &

# Instance 2
PORT=3001 TARGET_URL=https://api.production.com npm start &

# Instance 3
PORT=3002 TARGET_URL=https://api.production.com npm start &
```

## Process Management

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bff-proxy',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        TARGET_URL: 'https://api.production.com',
        CACHE_TTL: 600,
        CACHEABLE_METHODS: 'GET,POST',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
```

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Restart
pm2 restart bff-proxy
```

### Systemd Service

```ini
# /etc/systemd/system/bff-proxy.service
[Unit]
Description=BFF Proxy Service
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/bff-proxy
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
Environment=TARGET_URL=https://api.production.com
Environment=CACHE_TTL=600
Environment=CACHEABLE_METHODS=GET,POST

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable bff-proxy
sudo systemctl start bff-proxy
sudo systemctl status bff-proxy
```

## Monitoring and Logging

### Health Checks

```bash
# Basic health check
curl -f http://localhost:3000/health || exit 1

# Detailed monitoring
curl http://localhost:3000/cache/stats
```

### Log Aggregation

```bash
# Production logging with JSON format
NODE_ENV=production npm start 2>&1 | tee /var/log/bff-proxy.log
```

### Monitoring Setup

```javascript
// Add to your monitoring system
const healthCheck = async () => {
  try {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();

    // Monitor cache size
    console.log(`Cache size: ${data.cache.size}`);

    // Alert if cache is too large
    if (data.cache.size > 1000) {
      console.warn('Cache size is large, consider cleaning');
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
};

setInterval(healthCheck, 30000); // Every 30 seconds
```

## Performance Optimization

### Memory Management

```bash
# Set Node.js memory limits
node --max-old-space-size=512 dist/index.js

# Monitor memory usage
ps aux | grep node
```

### Cache Optimization

```bash
# Production cache settings
NODE_ENV=production \
TARGET_URL=https://api.production.com \
CACHE_TTL=1800 \
CACHEABLE_METHODS=GET,POST \
npm start
```

## Security Considerations

### Environment Secrets

```bash
# Use secret management
export TARGET_URL=$(vault kv get -field=url secret/api)
export API_KEY=$(vault kv get -field=key secret/api)
```

### Network Security

```bash
# Bind to localhost only
HOST=127.0.0.1 npm start

# Use reverse proxy for external access
# Nginx/Traefik with SSL termination
```

### Rate Limiting

Add rate limiting with reverse proxy:

```nginx
# Nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://bff_proxy;
    }
}
```

## Deployment Strategies

### Blue-Green Deployment

```bash
# Deploy to green environment
docker run -d --name bff-proxy-green -p 3001:3000 bff-proxy:new

# Test green environment
curl http://localhost:3001/health

# Switch traffic (update load balancer)
# Nginx upstream switch or DNS change

# Stop blue environment
docker stop bff-proxy-blue
```

### Rolling Updates

```yaml
# Kubernetes rolling update
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

### Canary Deployment

```bash
# Route 10% traffic to new version
# 90% to stable version via load balancer weights
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**

   ```bash
   # Clear cache
   curl -X DELETE http://localhost:3000/cache

   # Reduce cache TTL
   CACHE_TTL=300 npm start
   ```

2. **Connection Errors**

   ```bash
   # Check target URL accessibility
   curl https://api.production.com/health

   # Verify network connectivity
   telnet api.production.com 443
   ```

3. **Performance Issues**

   ```bash
   # Monitor cache hit rate
   curl http://localhost:3000/cache/stats

   # Check response times
   curl -w "@curl-format.txt" http://localhost:3000/api/test
   ```

### Debugging

```bash
# Enable debug logging
DEBUG=* npm start

# Production debugging (careful with sensitive data)
NODE_ENV=production DEBUG=proxy-server:* npm start
```

---

**Next:** Learn about development setup in the [Development Guide](./development.md).
