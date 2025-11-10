# Context Processing Service Dockerfile
FROM node:18-alpine

# Metadata
LABEL maintainer="IRIS Code Enhanced Team"
LABEL version="1.0.0"
LABEL description="Context Processing Pipeline Service"

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
  CMD curl -f http://localhost:${CONTEXT_PROCESSING_PORT:-8102}/health || exit 1

# Expose port
EXPOSE ${CONTEXT_PROCESSING_PORT:-8102}

# Start application
CMD ["node", "index.js"]