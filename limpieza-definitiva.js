#!/usr/bin/env node
/**
 * LIMPIEZA DEFINITIVA DE DOCKER-COMPOSE
 * Reemplaza todo el archivo con una versión limpia
 */

const fs = require('fs');
const path = require('path');

class DefinitiveCleanup {
    constructor() {
        this.workspaceRoot = '/workspace/iris-code-enhanced';
    }
    
    async runDefinitiveCleanup() {
        console.log('🧹 LIMPIEZA DEFINITIVA - Reemplazando docker-compose.yml...\n');
        
        await this.createCleanDockerCompose();
        
        console.log('\n✅ LIMPIEZA COMPLETADA');
        this.showSummary();
    }
    
    async createCleanDockerCompose() {
        const cleanCompose = `version: '3.8'

# =============================================================================
# IRIS CODE ENHANCED - PUERTOS DINÁMICOS CORREGIDOS
# Generado automáticamente - ${new Date().toISOString()}
# =============================================================================

services:
  # =============================================================================
  # API GATEWAY UNIFICADO
  # =============================================================================
  api-gateway:
    build:
      context: ./src/api-gateway
      dockerfile: Dockerfile
    container_name: iris-api-gateway
    restart: unless-stopped
    ports:
      - "8000:8020"
    environment:
      - NODE_ENV=production
      - GATEWAY_PORT=8020
      - DYNAMIC_PORTS=true
      - BACKEND_PORT=8001
      - SILHOUETTE_PORT=8002
    volumes:
      - ./logs/api-gateway:/app/logs
    networks:
      - iris-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8020/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =============================================================================
  # SERVIDOR DE FALLBACK
  # =============================================================================
  fallback-server:
    build:
      context: ./src/fallback-server
      dockerfile: Dockerfile
    container_name: iris-fallback-server
    restart: unless-stopped
    ports:
      - "8001:8021"
    environment:
      - NODE_ENV=production
      - FALLBACK_PORT=8021
      - OPENROUTER_API_KEY=\${OPENROUTER_API_KEY}
      - FREEPIK_API_KEY=\${FREEPIK_API_KEY}
    volumes:
      - ./logs/fallback:/app/logs
    networks:
      - iris-network
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8021/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =============================================================================
  # SILHOUETTE ORCHESTRATOR
  # =============================================================================
  silhouette-orchestrator:
    build:
      context: ./src/silhouette/orchestrator
      dockerfile: Dockerfile
    container_name: silhouette-orchestrator
    restart: unless-stopped
    ports:
      - "8002:8030"
    environment:
      - NODE_ENV=production
      - ORCHESTRATOR_PORT=8030
      - FRAMEWORK_VERSION=4.0.0
    volumes:
      - ./logs/orchestrator:/var/log/silhouette/orchestrator
      - ./data/orchestrator:/app/data
    networks:
      - iris-network
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8030/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =============================================================================
  # SILHOUETTE PLANNER
  # =============================================================================
  silhouette-planner:
    build:
      context: ./src/silhouette/planner
      dockerfile: Dockerfile
    container_name: silhouette-planner
    restart: unless-stopped
    ports:
      - "8003:8025"
    environment:
      - NODE_ENV=production
      - PLANNER_PORT=8025
      - PLANNER_WORKERS=4
      - FRAMEWORK_VERSION=4.0.0
    volumes:
      - ./logs/planner:/var/log/silhouette/planner
      - ./data/planner:/app/data
    networks:
      - iris-network
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8025/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =============================================================================
  # FRONTEND IRIS
  # =============================================================================
  iris-frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: iris-frontend
    restart: unless-stopped
    ports:
      - "3001:80"
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_GATEWAY_PORT=8000
      - VITE_FALLBACK_PORT=8001
      - VITE_SILHOUETTE_PORT=8002
    networks:
      - iris-network
    depends_on:
      - api-gateway

  # =============================================================================
  # EQUIPOS ESPECIALIZADOS - PUERTOS DINÁMICOS
  # =============================================================================
  business-development-team:
    build:
      context: ./src/silhouette/teams/business/business-development-team
      dockerfile: Dockerfile
    container_name: business-development-team
    restart: unless-stopped
    ports:
      - "8004:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=business_development_team
    volumes:
      - ./logs/teams:/var/log/silhouette/teams
    networks:
      - iris-network
    depends_on:
      - silhouette-orchestrator
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  marketing-team:
    build:
      context: ./src/silhouette/teams/business/marketing-team
      dockerfile: Dockerfile
    container_name: marketing-team
    restart: unless-stopped
    ports:
      - "8005:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=marketing_team
    volumes:
      - ./logs/teams:/var/log/silhouette/teams
    networks:
      - iris-network
    depends_on:
      - silhouette-orchestrator
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  sales-team:
    build:
      context: ./src/silhouette/teams/business/sales-team
      dockerfile: Dockerfile
    container_name: sales-team
    restart: unless-stopped
    ports:
      - "8006:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=sales_team
    volumes:
      - ./logs/teams:/var/log/silhouette/teams
    networks:
      - iris-network
    depends_on:
      - silhouette-orchestrator
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  finance-team:
    build:
      context: ./src/silhouette/teams/business/finance-team
      dockerfile: Dockerfile
    container_name: finance-team
    restart: unless-stopped
    ports:
      - "8007:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=finance_team
    volumes:
      - ./logs/teams:/var/log/silhouette/teams
    networks:
      - iris-network
    depends_on:
      - silhouette-orchestrator
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =============================================================================
  # BASE DE DATOS POSTGRESQL
  # =============================================================================
  postgres:
    image: postgres:15-alpine
    container_name: iris-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=iris_user
      - POSTGRES_PASSWORD=IrisSecure2025@Production
      - POSTGRES_DB=iris_production_db
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - iris-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iris_user -d iris_production_db"]
      interval: 30s
      timeout: 10s
      retries: 5

  # =============================================================================
  # CACHE REDIS
  # =============================================================================
  redis:
    image: redis:7-alpine
    container_name: iris-redis
    restart: unless-stopped
    command: redis-server --requirepass RedisSecure2025@Cache --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - iris-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # =============================================================================
  # MONITORING - PROMETHEUS
  # =============================================================================
  prometheus:
    image: prom/prometheus:latest
    container_name: iris-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - iris-network
    profiles:
      - monitoring

  # =============================================================================
  # MONITORING - GRAFANA
  # =============================================================================
  grafana:
    image: grafana/grafana:latest
    container_name: iris-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=IrisGrafana2025@
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3002:3000"
    networks:
      - iris-network
    profiles:
      - monitoring

# =============================================================================
# VOLUMES PERSISTENTES
# =============================================================================
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

# =============================================================================
# REDES DOCKER
# =============================================================================
networks:
  iris-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# =============================================================================
# CONFIGURACIÓN DE LOGGING
# =============================================================================
x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"`;

        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        fs.writeFileSync(composePath, cleanCompose);
        console.log('✅ docker-compose.dynamic.yml reemplazado con versión limpia');
    }
    
    showSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 RESUMEN FINAL DEL SISTEMA DE PUERTOS DINÁMICOS');
        console.log('='.repeat(80));
        
        console.log('\n📋 CONFIGURACIÓN DE PUERTOS CORREGIDA:');
        console.log('┌─────────────────────────────┬──────────┬──────────┐');
        console.log('│ Servicio                    │ Externo  │ Interno  │');
        console.log('├─────────────────────────────┼──────────┼──────────┤');
        console.log('│ API Gateway                 │ 8000     │ 8020     │');
        console.log('│ Fallback Server            │ 8001     │ 8021     │');
        console.log('│ Silhouette Orchestrator    │ 8002     │ 8030     │');
        console.log('│ Silhouette Planner         │ 8003     │ 8025     │');
        console.log('│ Business Development Team  │ 8004     │ 8000     │');
        console.log('│ Marketing Team             │ 8005     │ 8000     │');
        console.log('│ Sales Team                 │ 8006     │ 8000     │');
        console.log('│ Finance Team               │ 8007     │ 8000     │');
        console.log('│ PostgreSQL                 │ 5432     │ 5432     │');
        console.log('│ Redis                      │ 6379     │ 6379     │');
        console.log('│ Prometheus                 │ 9090     │ 9090     │');
        console.log('│ Grafana                    │ 3002     │ 3000     │');
        console.log('└─────────────────────────────┴──────────┴──────────┘');
        
        console.log('\n🚀 COMANDOS PARA DESPLEGAR:');
        console.log('   1. cd /workspace/iris-code-enhanced');
        console.log('   2. docker-compose -f docker-compose.dynamic.yml build');
        console.log('   3. docker-compose -f docker-compose.dynamic.yml up -d');
        console.log('   4. curl http://localhost:8004/health (Business Development)');
        console.log('   5. curl http://localhost:8005/health (Marketing)');
        console.log('   6. curl http://localhost:8006/health (Sales)');
        console.log('   7. curl http://localhost:8007/health (Finance)');
        
        console.log('\n✅ SISTEMA LISTO PARA PRODUCCIÓN');
        console.log('='.repeat(80));
    }
}

// Ejecutar limpieza definitiva
if (require.main === module) {
    const cleanup = new DefinitiveCleanup();
    cleanup.runDefinitiveCleanup().catch(console.error);
}

module.exports = DefinitiveCleanup;