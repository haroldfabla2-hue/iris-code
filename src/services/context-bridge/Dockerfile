# Context Bridge Service Dockerfile
FROM node:18-alpine

# Configuración de directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache \
    curl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Copiar package.json y instalar dependencias
COPY package.json ./
RUN npm install --production

# Copiar código fuente
COPY . .

# Crear directorio de logs
RUN mkdir -p logs/context-bridge

# Configurar permisos
RUN chown -R node:node /app
USER node

# Exponer puerto
EXPOSE 8104

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8104/health || exit 1

# Comando de inicio
CMD ["node", "index.js"]