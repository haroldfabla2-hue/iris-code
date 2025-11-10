# Dockerfile para IRIS Fallback Server
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorio de logs
RUN mkdir -p logs

# Exponer puerto
EXPOSE 8021

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8021/health || exit 1

# Comando por defecto
CMD ["node", "fallback-server.js"]