#!/bin/bash
# =============================================================================
# IRIS CODE ENHANCED - DEPLOYMENT SCRIPT
# Framework Silhouette V4.0 + Sistema de Fallback Inteligente
# =============================================================================

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/deployment-$(date +%Y%m%d-%H%M%S).log"
ENV_FILE="$PROJECT_ROOT/.env.production"

# Función de logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

# Banner
show_banner() {
    echo -e "${PURPLE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║        🚀 IRIS CODE ENHANCED - SILHOUETTE V4.0 🚀            ║
    ║                                                              ║
    ║    Sistema Multi-Agente Empresarial Completo                ║
    ║    78+ Equipos Especializados + Fallback Inteligente       ║
    ║                                                              ║
    ║                  🚀 Deployment Iniciado 🚀                  ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Verificar prerrequisitos
check_prerequisites() {
    log "Verificando prerrequisitos del sistema..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        error "Docker no está instalado. Instalar Docker primero."
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose no está instalado. Instalar Docker Compose primero."
    fi
    
    # Verificar versión de Docker
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [[ $(echo "$DOCKER_VERSION 20.0" | awk '{print ($1 >= $2)}') -eq 0 ]]; then
        error "Docker versión $DOCKER_VERSION no es compatible. Se requiere Docker 20.0+"
    fi
    
    # Verificar recursos del sistema
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    DISK_GB=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    
    if [ "$MEMORY_GB" -lt 8 ]; then
        warning "Memoria RAM baja detectada: ${MEMORY_GB}GB. Se recomienda 16GB+ para mejor rendimiento."
    fi
    
    if [ "$DISK_GB" -lt 50 ]; then
        warning "Espacio en disco bajo: ${DISK_GB}GB. Se recomienda 100GB+ para el sistema completo."
    fi
    
    # Verificar puertos disponibles
    check_port 3000 "Backend Principal"
    check_port 8030 "Silhouette Orchestrator"
    check_port 8025 "Silhouette Planner"
    check_port 5432 "PostgreSQL"
    check_port 6379 "Redis"
    
    success "Prerrequisitos verificados correctamente"
}

# Verificar si un puerto está disponible
check_port() {
    local port=$1
    local description=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        warning "Puerto $port ($description) ya está en uso"
        return 1
    fi
    return 0
}

# Verificar archivo de configuración
check_configuration() {
    log "Verificando configuración del proyecto..."
    
    # Verificar archivo .env
    if [ ! -f "$ENV_FILE" ]; then
        error "Archivo $ENV_FILE no encontrado. Copiar desde .env.production.example"
    fi
    
    # Verificar variables críticas
    check_env_var "POSTGRES_PASSWORD" "Contraseña de PostgreSQL"
    check_env_var "REDIS_PASSWORD" "Contraseña de Redis"
    check_env_var "JWT_SECRET" "Secreto JWT"
    check_env_var "ENCRYPTION_KEY" "Clave de encriptación"
    
    success "Configuración verificada"
}

# Verificar variable de entorno
check_env_var() {
    local var_name=$1
    local description=$2
    
    if ! grep -q "^$var_name=" "$ENV_FILE" || grep -q "^$var_name=your_.*_here$" "$ENV_FILE"; then
        error "Variable de entorno $var_name ($description) no está configurada en $ENV_FILE"
    fi
}

# Crear directorios necesarios
create_directories() {
    log "Creando directorios necesarios..."
    
    local directories=(
        "logs"
        "logs/iris-code"
        "logs/silhouette"
        "logs/silhouette/orchestrator"
        "logs/silhouette/planner"
        "logs/silhouette/optimization"
        "logs/silhouette/mcp-server"
        "logs/teams"
        "logs/teams/business"
        "logs/teams/audiovisual"
        "logs/teams/dynamic"
        "logs/nginx"
        "data"
        "data/orchestrator"
        "data/planner"
        "data/optimization"
        "data/mcp-server"
        "data/images"
        "data/animations"
        "data/videos"
        "data/scripts"
        "backups"
        "uploads"
        "nginx/ssl"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$PROJECT_ROOT/$dir"
        info "Directorio creado: $dir"
    done
    
    success "Directorios creados correctamente"
}

# Construir imágenes Docker
build_images() {
    log "Construyendo imágenes Docker..."
    
    local services=(
        "iris-backend"
        "silhouette-orchestrator"
        "silhouette-planner"
        "silhouette-optimization-team"
        "silhouette-mcp-server"
        "marketing-team"
        "image-search-team"
        "animation-prompt-generator"
        "video-scene-composer"
        "professional-script-generator"
    )
    
    for service in "${services[@]}"; do
        log "Construyendo imagen: $service"
        if docker build -t "iris-enhanced/$service:latest" "$PROJECT_ROOT/src/silhouette/$(echo $service | sed 's/-team//g' | sed 's/silhouette-//g' | sed 's/image-search/teams\/audiovisual\/image_search/' | sed 's/animation-prompt/teams\/audiovisual\/animation_prompt/' | sed 's/video-scene/teams\/audiovisual\/video_scene/' | sed 's/professional-script/teams\/audiovisual\/professional_script/' | sed 's/marketing/teams\/business\/marketing/')" 2>&1 | tee -a "$LOG_FILE"; then
            success "Imagen construida: $service"
        else
            error "Error construyendo imagen: $service"
        fi
    done
}

# Inicializar base de datos
init_database() {
    log "Inicializando base de datos..."
    
    # Levantar solo PostgreSQL primero
    docker-compose up -d postgres
    
    # Esperar a que PostgreSQL esté listo
    log "Esperando a que PostgreSQL esté disponible..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U iris_user -d iris_production_db; then
            break
        fi
        sleep 2
    done
    
    # Ejecutar scripts de inicialización
    if [ -f "$PROJECT_ROOT/scripts/silhouette/init-silhouette-db.sql" ]; then
        log "Ejecutando scripts de inicialización de Silhouette..."
        docker-compose exec -T postgres psql -U iris_user -d iris_production_db -f /docker-entrypoint-initdb.d/silhouette-init.sql
    fi
    
    success "Base de datos inicializada"
}

# Deployment por fases
deploy_phases() {
    local phase=$1
    
    case $phase in
        "1"|"base")
            log "Fase 1: Servicios base (iris-code original)"
            docker-compose up -d iris-backend iris-frontend postgres redis nginx
            ;;
        "2"|"core")
            log "Fase 2: Componentes core de Silhouette"
            docker-compose up -d silhouette-orchestrator silhouette-planner silhouette-optimization-team silhouette-mcp-server
            ;;
        "3"|"business")
            log "Fase 3: Equipos empresariales"
            docker-compose up -d business-development-team marketing-team sales-team finance-team
            ;;
        "4"|"audiovisual")
            log "Fase 4: Sistema audiovisual"
            docker-compose up -d image-search-team animation-prompt-generator video-scene-composer professional-script-generator
            ;;
        "5"|"dynamic")
            log "Fase 5: Workflows dinámicos"
            docker-compose up -d compliance-team cybersecurity-team data-engineering-team ecommerce-team
            ;;
        "6"|"monitoring")
            log "Fase 6: Monitoreo"
            docker-compose --profile monitoring up -d prometheus grafana
            ;;
        "all")
            log "Deployment completo en todas las fases"
            deploy_phases "1"
            sleep 30
            deploy_phases "2"
            sleep 30
            deploy_phases "3"
            sleep 30
            deploy_phases "4"
            sleep 30
            deploy_phases "5"
            sleep 30
            deploy_phases "6"
            ;;
        *)
            error "Fase desconocida: $phase"
            ;;
    esac
}

# Verificar salud de servicios
health_check() {
    log "Verificando salud de servicios..."
    
    local services=(
        "iris-backend"
        "silhouette-orchestrator"
        "silhouette-planner"
        "silhouette-optimization-team"
        "silhouette-mcp-server"
    )
    
    local healthy=0
    local total=${#services[@]}
    
    for service in "${services[@]}"; do
        if curl -sf http://localhost:$(get_service_port $service)/health > /dev/null 2>&1; then
            success "✅ $service: Saludable"
            ((healthy++))
        else
            error "❌ $service: No saludable"
        fi
    done
    
    if [ $healthy -eq $total ]; then
        success "Todos los servicios están saludables ($healthy/$total)"
    else
        warning "Algunos servicios no están saludables ($healthy/$total)"
        return 1
    fi
}

# Obtener puerto de servicio
get_service_port() {
    case $1 in
        "iris-backend") echo "3000" ;;
        "silhouette-orchestrator") echo "8030" ;;
        "silhouette-planner") echo "8025" ;;
        "silhouette-optimization-team") echo "8033" ;;
        "silhouette-mcp-server") echo "8027" ;;
        *) echo "8080" ;;
    esac
}

# Test del sistema
test_system() {
    log "Ejecutando tests del sistema..."
    
    # Test de conectividad
    log "Test 1: Conectividad básica"
    if curl -sf http://localhost:3000/health > /dev/null; then
        success "Backend principal respondiendo"
    else
        error "Backend principal no responde"
    fi
    
    # Test de Silhouette
    log "Test 2: Silhouette Orchestrator"
    if curl -sf http://localhost:8030/health > /dev/null; then
        success "Silhouette Orchestrator respondiendo"
    else
        error "Silhouette Orchestrator no responde"
    fi
    
    # Test de equipos
    log "Test 3: Equipos especializados"
    if curl -sf http://localhost:8030/teams > /dev/null; then
        success "API de equipos funcionando"
    else
        error "API de equipos no funciona"
    fi
    
    # Test de base de datos
    log "Test 4: Conectividad a base de datos"
    if docker-compose exec -T postgres pg_isready -U iris_user -d iris_production_db > /dev/null 2>&1; then
        success "PostgreSQL accesible"
    else
        error "PostgreSQL no accesible"
    fi
    
    # Test de Redis
    log "Test 5: Conectividad a Redis"
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        success "Redis accesible"
    else
        error "Redis no accesible"
    fi
    
    success "Tests del sistema completados"
}

# Mostrar información post-deployment
show_post_deployment_info() {
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║              🎉 DEPLOYMENT COMPLETADO EXITOSAMENTE 🎉         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${CYAN}📊 Servicios Disponibles:${NC}"
    echo -e "  • Backend Principal:     ${YELLOW}http://localhost:3000${NC}"
    echo -e "  • Frontend:              ${YELLOW}http://localhost:3001${NC}"
    echo -e "  • Silhouette Orchestrator: ${YELLOW}http://localhost:8030${NC}"
    echo -e "  • Silhouette Planner:    ${YELLOW}http://localhost:8025${NC}"
    echo -e "  • Grafana (Monitoreo):   ${YELLOW}http://localhost:3000${NC}"
    echo -e "  • Prometheus:            ${YELLOW}http://localhost:9090${NC}\n"
    
    echo -e "${CYAN}🔧 Comandos Útiles:${NC}"
    echo -e "  • Ver estado:     ${YELLOW}docker-compose ps${NC}"
    echo -e "  • Ver logs:       ${YELLOW}docker-compose logs -f [servicio]${NC}"
    echo -e "  • Health check:   ${YELLOW}curl http://localhost:8030/health${NC}"
    echo -e "  • Parar sistema:  ${YELLOW}docker-compose down${NC}\n"
    
    echo -e "${CYAN}🚀 Ejemplo de Uso:${NC}"
    echo -e "  ${PURPLE}# Crear estrategia de marketing${NC}"
    echo -e "  ${YELLOW}curl -X POST http://localhost:8030/teams/marketing-team/execute \\"
    echo -e "    -H 'Content-Type: application/json' \\"
    echo -e "    -d '{\"task\": \"create_marketing_strategy\", \"parameters\": {\"business_type\": \"SaaS\"}}'\n"
    
    echo -e "${CYAN}📖 Documentación:${NC}"
    echo -e "  • README: ${YELLOW}./README.md${NC}"
    echo -e "  • API Docs: ${YELLOW}./docs/api-reference.md${NC}"
    echo -e "  • Logs: ${YELLOW}./logs/deployment-$(date +%Y%m%d)*.log${NC}\n"
    
    echo -e "${GREEN}✅ Sistema listo para usar con 78+ equipos especializados${NC}\n"
}

# Manejo de señales
cleanup() {
    error "Deployment interrumpido. Limpiando..."
    docker-compose down
    exit 1
}

trap cleanup INT TERM

# Función principal
main() {
    # Crear directorio de logs
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Mostrar banner
    show_banner
    
    # Verificar argumentos
    local deployment_phase="${1:-all}"
    local skip_build="${2:-false}"
    local skip_tests="${3:-false}"
    
    log "Iniciando deployment de IRIS CODE ENHANCED con Silhouette V4.0"
    log "Fase de deployment: $deployment_phase"
    log "Omitir build: $skip_build"
    log "Omitir tests: $skip_tests"
    
    # Verificaciones y preparación
    check_prerequisites
    check_configuration
    create_directories
    
    # Build de imágenes (opcional)
    if [ "$skip_build" = "false" ]; then
        build_images
    else
        log "Build de imágenes omitido por solicitud del usuario"
    fi
    
    # Inicializar base de datos
    init_database
    
    # Deployment
    deploy_phases "$deployment_phase"
    
    # Esperar a que los servicios estén listos
    log "Esperando a que los servicios estén listos..."
    sleep 30
    
    # Tests (opcional)
    if [ "$skip_tests" = "false" ]; then
        health_check
        test_system
    else
        log "Tests omitidos por solicitud del usuario"
    fi
    
    # Mostrar información final
    show_post_deployment_info
    
    success "Deployment completado exitosamente"
}

# Mostrar ayuda
show_help() {
    cat << EOF
IRIS CODE ENHANCED - Deployment Script

Uso: $0 [fase] [opciones]

Fases de Deployment:
  all          - Deployment completo (default)
  1|base       - Solo servicios base (iris-code)
  2|core       - Componentes core de Silhouette
  3|business   - Equipos empresariales
  4|audiovisual - Sistema audiovisual
  5|dynamic    - Workflows dinámicos
  6|monitoring - Monitoreo

Opciones:
  --skip-build     - Omitir construcción de imágenes Docker
  --skip-tests     - Omitir tests de verificación
  --help           - Mostrar esta ayuda

Ejemplos:
  $0                    # Deployment completo
  $0 2 --skip-tests     # Solo core de Silhouette, sin tests
  $0 3                  # Solo equipos empresariales
  $0 all --skip-build   # Deployment completo usando imágenes existentes

Para más información, consulta ./README.md

EOF
}

# Procesar argumentos
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac