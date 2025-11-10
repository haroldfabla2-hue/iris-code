# Memory Management Service Dockerfile
FROM node:18-alpine

# Metadata
LABEL maintainer="IRIS Code Enhanced Team"
LABEL version="1.0.0"
LABEL description="Memory Management Service for Context Memory Infrastructure"

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${MEMORY_MANAGEMENT_PORT:-8104}/health || exit 1

# Expose port
EXPOSE ${MEMORY_MANAGEMENT_PORT:-8104}

# Start application
CMD ["node", "index.js"]