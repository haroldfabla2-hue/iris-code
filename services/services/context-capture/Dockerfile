FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && ln -sf python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/
COPY scripts/ ./scripts/

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S context-capture -u 1001

# Change ownership
RUN chown -R context-capture:nodejs /app

# Switch to non-root user
USER context-capture

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start application
CMD ["npm", "start"]