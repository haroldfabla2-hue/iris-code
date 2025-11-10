# Dockerfile para Unified API Gateway
FROM node:18-alpine

# Instalar dependencias
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
EXPOSE 8020

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8020/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando por defecto
CMD ["node", "unified-api-gateway.js"]