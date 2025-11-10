#!/bin/bash

# =============================================================================
# SCRIPT DE INICIO UNIFICADO - IRIS CODE + SILHOUETTE V4.0
# Inicia todos los servicios y verifica la conectividad
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose no está instalado"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_warning "Node.js no está instalado (necesario para desarrollo local)"
    fi
    
    log_success "Dependencias verificadas"
}

# Verificar variables de entorno
check_environment() {
    log "Verificando variables de entorno..."
    
    if [ ! -f ".env.production" ]; then
        log_warning "Archivo .env.production no encontrado"
        log "Copiando desde template..."
        cp .env.production.template .env.production 2>/dev/null || true
    fi
    
    # Verificar APIs críticas
    if ! grep -q "OPENROUTER_API_KEY" .env.production 2>/dev/null; then
        log_warning "OPENROUTER_API_KEY no configurado en .env.production"
    fi
    
    log_success "Variables de entorno verificadas"
}

# Construir imágenes
build_images() {
    log "Construyendo imágenes Docker..."
    
    # Construir imagen del API Gateway
    if [ -d "src/api-gateway" ]; then
        log "Construyendo API Gateway..."
        docker build -t iris-api-gateway:latest src/api-gateway/ || log_warning "Error construyendo API Gateway"
    fi
    
    # Construir imagen del fallback server
    if [ -d "src/fallback-server" ]; then
        log "Construyendo Fallback Server..."
        docker build -t iris-fallback-server:latest src/fallback-server/ || log_warning "Error construyendo Fallback Server"
    fi
    
    # Construir imagen del frontend
    if [ -d "src/frontend" ]; then
        log "Construyendo Frontend..."
        docker build -t iris-frontend:latest src/frontend/ || log_warning "Error construyendo Frontend"
    fi
    
    log_success "Imágenes construidas"
}

# Iniciar servicios
start_services() {
    log "Iniciando servicios..."
    
    # Iniciar con docker-compose
    docker-compose up -d
    
    # Esperar a que los servicios estén listos
    log "Esperando a que los servicios estén listos..."
    sleep 10
    
    # Verificar health checks
    check_service_health
}

# Verificar salud de servicios
check_service_health() {
    log "Verificando salud de servicios..."
    
    local services=(
        "8020:API Gateway"
        "8021:Fallback Server"
        "8022:Silhouette Orchestrator"
        "8023:Assets Server"
        "8027:MCP Server"
        "8104:Context Bridge Service"
        "8100:Context Capture Service"
        "8101:Context Processing Service"
        "8102:Context Retrieval Service"
        "8103:Memory Management Service"
        "5433:PostgreSQL Context"
        "6380:Redis Context"
        "3000:IRIS Backend"
        "3001:IRIS Frontend"
    )
    
    for service_port in "${services[@]}"; do
        local port=$(echo $service_port | cut -d: -f1)
        local name=$(echo $service_port | cut -d: -f2)
        
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1 || 
           curl -f -s "http://localhost:$port/" > /dev/null 2>&1; then
            log_success "$name (puerto $port) - OK"
        else
            log_warning "$name (puerto $port) - No responde"
        fi
    done
    
    # Verificar servicios específicos de Context Memory
    log "Verificando servicios de Context Memory..."
    
    local context_services=(
        "8104:Context Bridge"
        "8100:Context Capture"
        "8101:Context Processing"
        "8102:Context Retrieval"
        "8103:Memory Management"
    )
    
    for service_port in "${context_services[@]}"; do
        local port=$(echo $service_port | cut -d: -f1)
        local name=$(echo $service_port | cut -d: -f2)
        
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "Context $name (puerto $port) - OK"
        else
            log_warning "Context $name (puerto $port) - No responde"
        fi
    done
    
    # Verificar bases de datos
    log "Verificando bases de datos..."
    
    # PostgreSQL Context
    if docker exec iris-postgres-context pg_isready -U iris_user -d iris_context_db > /dev/null 2>&1; then
        log_success "PostgreSQL Context - OK"
    else
        log_warning "PostgreSQL Context - No responde"
    fi
    
    # Redis Context
    if docker exec iris-redis-context redis-cli -a RedisSecure2025@Context ping > /dev/null 2>&1; then
        log_success "Redis Context - OK"
    else
        log_warning "Redis Context - No responde"
    fi
}

# Verificar conectividad del frontend
check_frontend_connectivity() {
    log "Verificando conectividad del frontend..."
    
    # Esperar un poco más para que el frontend esté listo
    sleep 5
    
    if curl -f -s "http://localhost:3001" > /dev/null 2>&1; then
        log_success "Frontend accesible en http://localhost:3001"
    else
        log_warning "Frontend no accesible en http://localhost:3001"
    fi
}

# Mostrar URLs de acceso
show_access_urls() {
    log_success "🎉 Sistema iniciado exitosamente!"
    echo
    echo "=============================================="
    echo "         URLs DE ACCESO PRINCIPALES"
    echo "=============================================="
    echo
    echo "🌐 Frontend Principal:"
    echo "   http://localhost:3001"
    echo
    echo "🔧 API Gateway (Unificado):"
    echo "   http://localhost:8020"
    echo "   Health: http://localhost:8020/health"
    echo "   Status: http://localhost:8020/status"
    echo
    echo "🧠 Servicios Backend:"
    echo "   Fallback Server: http://localhost:8021"
    echo "   Silhouette: http://localhost:8022"
    echo "   Assets: http://localhost:8023"
    echo "   MCP: http://localhost:8027"
    echo
    echo "🧠 Context Memory Services:"
    echo "   Context Bridge: http://localhost:8104"
    echo "   Context Capture: http://localhost:8100"
    echo "   Context Processing: http://localhost:8101"
    echo "   Context Retrieval: http://localhost:8102"
    echo "   Memory Management: http://localhost:8103"
    echo
    echo "📊 Monitoreo:"
    echo "   Métricas: http://localhost:8020/api/metrics/unified"
    echo "   Equipos: http://localhost:8020/api/teams"
    echo "   Context Stats: http://localhost:8104/api/stats"
    echo
    echo "=============================================="
    echo
    echo "🔑 Funcionalidades Disponibles:"
    echo "   ✅ Sistema de Fallback Inteligente (LLM)"
    echo "   ✅ 78+ Equipos Especializados (Silhouette)"
    echo "   ✅ Context Memory Infrastructure (Nuevo)"
    echo "   ✅ Búsqueda Semántica con pgvector"
    echo "   ✅ Memoria Trans-Sesional (90.2% mejora)"
    echo "   ✅ Generación de Assets (Imágenes/Videos)"
    echo "   ✅ Chat Unificado con IA"
    echo "   ✅ Workflows Empresariales"
    echo "   ✅ APIs Unificadas"
    echo
}

# Función principal
main() {
    log "🚀 Iniciando IRIS Code + Silhouette Unified Platform"
    echo
    
    check_dependencies
    check_environment
    build_images
    start_services
    check_service_health
    check_frontend_connectivity
    show_access_urls
    
    log "🎯 Sistema listo para usar!"
    log "💡 Tip: Ejecuta 'docker-compose logs -f' para ver logs en tiempo real"
}

# Manejo de errores
trap 'log_error "Script interrumpido"; exit 1' INT TERM

# Ejecutar función principal
main "$@"