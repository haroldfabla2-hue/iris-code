# Dockerfile para Silhouette Orchestrator
FROM node:18-alpine

# Metadata
LABEL maintainer="MiniMax Agent" 
LABEL version="4.0.0"
LABEL description="Silhouette V4.0 - Orchestrator (Coordinador Central)"

# Configuración de la aplicación
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copiar archivos de configuración de Node.js
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Crear directorios necesarios
RUN mkdir -p \
    logs/orchestrator \
    data/orchestrator \
    config

# Copiar código de la aplicación
COPY orchestrator.js ./

# Configurar permisos
RUN chown -R node:node /app
USER node

# Exponer puerto
EXPOSE 8030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8030/health || exit 1

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV FRAMEWORK_VERSION=4.0.0
ENV LOG_LEVEL=info
ENV ORCHESTRATOR_PORT=8030

# Comando de inicio
CMD ["node", "orchestrator.js"]