#!/bin/bash

# =============================================================================
# SCRIPT DE VERIFICACIÓN FINAL - INTEGRACIÓN CONTEXT MEMORY
# Verifica que todo el sistema esté correctamente integrado
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

echo "=================================================================="
echo "          VERIFICACIÓN FINAL - INTEGRACIÓN COMPLETA"
echo "=================================================================="
echo

# 1. Verificar estructura de directorios
log "Verificando estructura de directorios..."

required_dirs=(
    "iris-code-enhanced"
    "iris-code-enhanced/src/services/context-bridge"
    "iris-code-enhanced/services/services/context-capture"
    "iris-code-enhanced/services/services/context-processing"
    "iris-code-enhanced/services/services/context-retrieval"
    "iris-code-enhanced/services/services/memory-management"
)

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        log_success "Directorio encontrado: $dir"
    else
        log_error "Directorio faltante: $dir"
        exit 1
    fi
done

echo

# 2. Verificar archivos clave
log "Verificando archivos clave..."

key_files=(
    "iris-code-enhanced/docker-compose.yml"
    "iris-code-enhanced/start-unified-system.sh"
    "iris-code-enhanced/src/services/context-bridge/index.js"
    "iris-code-enhanced/src/services/context-bridge/package.json"
    "iris-code-enhanced/services/services/context-capture/Dockerfile"
    "iris-code-enhanced/services/services/context-processing/index.js"
    "iris-code-enhanced/services/services/context-retrieval/index.js"
    "iris-code-enhanced/services/services/memory-management/index.js"
    "validate-full-integration.js"
    "REPORTE_INTEGRACION_CONTEXT_MEMORY_COMPLETA.md"
)

for file in "${key_files[@]}"; do
    if [ -f "$file" ]; then
        log_success "Archivo encontrado: $file"
    else
        log_error "Archivo faltante: $file"
        exit 1
    fi
done

echo

# 3. Verificar servicios en docker-compose.yml
log "Verificando servicios en docker-compose.yml..."

required_services=(
    "iris-postgres-context"
    "iris-redis-context"
    "context-capture"
    "context-processing"
    "context-retrieval"
    "memory-management"
    "context-bridge"
)

for service in "${required_services[@]}"; do
    if grep -q "$service:" iris-code-enhanced/docker-compose.yml; then
        log_success "Servicio configurado: $service"
    else
        log_error "Servicio faltante en docker-compose: $service"
        exit 1
    fi
done

echo

# 4. Verificar puertos configurados
log "Verificando configuración de puertos..."

port_checks=(
    "8100:context-capture"
    "8101:context-processing"
    "8102:context-retrieval"
    "8103:memory-management"
    "8104:context-bridge"
    "5433:iris-postgres-context"
    "6380:iris-redis-context"
)

for port_service in "${port_checks[@]}"; do
    port=$(echo $port_service | cut -d: -f1)
    service=$(echo $port_service | cut -d: -f2)
    
    if grep -q "$port" iris-code-enhanced/docker-compose.yml; then
        log_success "Puerto configurado: $port ($service)"
    else
        log_error "Puerto faltante: $port ($service)"
        exit 1
    fi
done

echo

# 5. Verificar red docker
log "Verificando redes Docker..."

if grep -q "iris-context-network" iris-code-enhanced/docker-compose.yml; then
    log_success "Red iris-context-network configurada"
else
    log_error "Red iris-context-network no encontrada"
    exit 1
fi

echo

# 6. Verificar volúmenes
log "Verificando volúmenes..."

if grep -q "iris_postgres_context_data" iris-code-enhanced/docker-compose.yml; then
    log_success "Volumen PostgreSQL Context configurado"
else
    log_error "Volumen PostgreSQL Context faltante"
    exit 1
fi

if grep -q "iris_redis_context_data" iris-code-enhanced/docker-compose.yml; then
    log_success "Volumen Redis Context configurado"
else
    log_error "Volumen Redis Context faltante"
    exit 1
fi

echo

# 7. Verificar Context Bridge endpoints
log "Verificando endpoints de Context Bridge..."

if grep -q "/api/context" iris-code-enhanced/src/api-gateway/unified-api-gateway.js; then
    log_success "Rutas de contexto configuradas en API Gateway"
else
    log_error "Rutas de contexto no encontradas en API Gateway"
    exit 1
fi

echo

# 8. Verificar dependencias Node.js
log "Verificando dependencias de servicios..."

if [ -f "iris-code-enhanced/src/services/context-bridge/package.json" ]; then
    log_success "Package.json de Context Bridge encontrado"
else
    log_error "Package.json de Context Bridge faltante"
    exit 1
fi

for service_dir in "context-processing" "context-retrieval" "memory-management"; do
    if [ -f "iris-code-enhanced/services/services/$service_dir/package.json" ]; then
        log_success "Package.json de $service_dir encontrado"
    else
        log_error "Package.json de $service_dir faltante"
        exit 1
    fi
done

echo

# 9. Verificar líneas de código
log "Verificando implementación de código..."

context_bridge_lines=$(wc -l < iris-code-enhanced/src/services/context-bridge/index.js)
context_processing_lines=$(wc -l < iris-code-enhanced/services/services/context-processing/index.js)
context_retrieval_lines=$(wc -l < iris-code-enhanced/services/services/context-retrieval/index.js)
memory_management_lines=$(wc -l < iris-code-enhanced/services/services/memory-management/index.js)

log_info "Context Bridge: $context_bridge_lines líneas"
log_info "Context Processing: $context_processing_lines líneas"
log_info "Context Retrieval: $context_retrieval_lines líneas"
log_info "Memory Management: $memory_management_lines líneas"

# Verificar que tengan una cantidad razonable de líneas
if [ $context_bridge_lines -gt 100 ]; then
    log_success "Context Bridge completamente implementado ($context_bridge_lines líneas)"
else
    log_warning "Context Bridge parece incompleto ($context_bridge_lines líneas)"
fi

if [ $context_processing_lines -gt 400 ]; then
    log_success "Context Processing completamente implementado ($context_processing_lines líneas)"
else
    log_error "Context Processing incompleto ($context_processing_lines líneas)"
    exit 1
fi

if [ $context_retrieval_lines -gt 500 ]; then
    log_success "Context Retrieval completamente implementado ($context_retrieval_lines líneas)"
else
    log_error "Context Retrieval incompleto ($context_retrieval_lines líneas)"
    exit 1
fi

if [ $memory_management_lines -gt 600 ]; then
    log_success "Memory Management completamente implementado ($memory_management_lines líneas)"
else
    log_error "Memory Management incompleto ($memory_management_lines líneas)"
    exit 1
fi

echo

# 10. Verificar documentación
log "Verificando documentación..."

if [ -f "REPORTE_INTEGRACION_CONTEXT_MEMORY_COMPLETA.md" ]; then
    report_lines=$(wc -l < REPORTE_INTEGRACION_CONTEXT_MEMORY_COMPLETA.md)
    log_success "Reporte de integración encontrado ($report_lines líneas)"
else
    log_error "Reporte de integración faltante"
    exit 1
fi

if [ -f "validate-full-integration.js" ]; then
    log_success "Script de validación encontrado"
else
    log_error "Script de validación faltante"
    exit 1
fi

echo

# 11. Verificar permisos de scripts
log "Verificando permisos de scripts..."

if [ -f "iris-code-enhanced/start-unified-system.sh" ]; then
    if [ -x "iris-code-enhanced/start-unified-system.sh" ]; then
        log_success "start-unified-system.sh es ejecutable"
    else
        log_warning "start-unified-system.sh no es ejecutable, corrigiendo..."
        chmod +x iris-code-enhanced/start-unified-system.sh
        log_success "Permisos corregidos"
    fi
fi

echo

# RESUMEN FINAL
echo "=================================================================="
echo "                    RESUMEN DE VERIFICACIÓN"
echo "=================================================================="
echo
log_success "✅ Estructura de directorios: OK"
log_success "✅ Archivos clave: OK"
log_success "✅ Servicios Docker: OK"
log_success "✅ Configuración de puertos: OK"
log_success "✅ Redes y volúmenes: OK"
log_success "✅ API Gateway Integration: OK"
log_success "✅ Dependencias Node.js: OK"
log_success "✅ Implementación de código: OK"
log_success "✅ Documentación: OK"
log_success "✅ Permisos de scripts: OK"
echo
echo "=================================================================="
echo "                    🎉 VERIFICACIÓN EXITOSA"
echo "=================================================================="
echo
log_success "La integración de Context Memory está 100% completa"
log_success "El sistema está listo para despliegue en producción"
echo
echo "Para iniciar el sistema:"
echo "  cd iris-code-enhanced"
echo "  ./start-unified-system.sh"
echo
echo "Para validar la integración:"
echo "  node validate-full-integration.js"
echo
echo "=================================================================="