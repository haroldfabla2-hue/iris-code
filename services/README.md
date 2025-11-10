# 🔍 IRIS v2.0 Context Memory Infrastructure
## Fase 1: Context Memory Infrastructure - Implementación

**Fecha**: 2025-11-10  
**Versión**: 2.0.0  
**Autor**: MiniMax Agent  
**Estado**: Listo para Implementación  

---

## 📋 Descripción

La **Fase 1: Context Memory Infrastructure** implementa la base fundamental para el sistema de **Context Transcendence** de IRIS v2.0. Esta infraestructura proporciona:

- **Memoria Transsesional**: Almacenamiento de contexto con retención de 365 días
- **Búsqueda Semántica**: Vector similarity search con pgvector
- **Knowledge Graph**: Neo4j para relaciones complejas
- **Event Streaming**: Apache Kafka para procesamiento en tiempo real
- **Context Engineering**: Pipeline de procesamiento de contexto inteligente

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                    IRIS V2.0 CONTEXT ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────┤
│  Core Services                                                  │
│  ├── Context Capture Service (Port 8001)                        │
│  ├── Context Processing Pipeline (Port 8002)                    │
│  ├── Context Retrieval Service (Port 8003)                      │
│  └── Memory Management Service (Port 8004)                      │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ├── PostgreSQL + pgvector (Port 5432)                          │
│  ├── Neo4j Graph Database (Port 7687)                          │
│  ├── Redis Cache (Port 6379)                                   │
│  └── Apache Kafka (Port 9092)                                  │
├─────────────────────────────────────────────────────────────────┤
│  AI/ML Layer                                                    │
│  ├── OpenAI Embeddings (Semantic Analysis)                     │
│  ├── Context Scoring & Relevance                               │
│  └── Pattern Recognition                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **Runtime** | Node.js | 18+ | Servicios de aplicación |
| **Database** | PostgreSQL | 15 + pgvector | Eventos de contexto, vector search |
| **Graph DB** | Neo4j | 5.13 Community | Knowledge graph, relaciones |
| **Cache** | Redis | 7.2 | Session management, caching |
| **Message Queue** | Apache Kafka | 7.4.0 | Event streaming |
| **AI/ML** | OpenAI | GPT-4 + ada-002 | Context analysis, embeddings |
| **Container** | Docker + Compose | Latest | Infrastructure orchestration |

---

## 🚀 Instalación Rápida

### Prerrequisitos

- **Docker** 20.0+ y **Docker Compose** 2.0+
- **4GB+ RAM** disponible
- **20GB+** espacio en disco
- **OpenAI API Key** (requerido)

### 1. Clonar y Configurar

```bash
# Navegar al directorio de infraestructura
cd iris-v2.0/context-infrastructure/

# Crear archivo de entorno (se configurará automáticamente)
cp .env.example .env  # Si existe, o usar el script de setup

# Editar variables críticas en .env
nano .env
```

### 2. Configurar Variables de Entorno

Editar `/workspace/iris-v2.0/context-infrastructure/.env`:

```bash
# OBLIGATORIO: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Opcional: Personalizar credenciales de base de datos
POSTGRES_PASSWORD=IrisSecure2025@Context
REDIS_PASSWORD=RedisSecure2025@Context
NEO4J_PASSWORD=iris_secure_2025

# Configuración de red
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 3. Ejecutar Setup Automático

```bash
# Hacer el script ejecutable
chmod +x scripts/setup/setup-context-infrastructure.sh

# Ejecutar instalación completa
./scripts/setup/setup-context-infrastructure.sh
```

### 4. Verificar Estado

```bash
# Verificar servicios activos
docker-compose ps

# Verificar salud de servicios
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

---

## 📊 API Endpoints

### Context Capture Service (Puerto 8001)

#### Capturar Evento de Contexto
```bash
POST /api/v2/context/events
Content-Type: application/json

{
  "projectId": "uuid-project-id",
  "sessionId": "session-123",
  "actorId": "user-456",
  "type": "conversational",
  "content": "We need to implement context transcendence for better collaboration."
}
```

#### Respuesta
```json
{
  "success": true,
  "eventId": "uuid-generated",
  "processingTime": 245,
  "contextScore": 0.85,
  "insights": [
    {
      "type": "collaborative",
      "confidence": 0.88
    }
  ]
}
```

#### Estadísticas de Contexto
```bash
GET /api/v2/context/stats?projectId=uuid&timeframe=24h
```

### Context Retrieval Service (Puerto 8003)

#### Buscar Contexto Relevante
```bash
POST /api/v2/context/search
Content-Type: application/json

{
  "projectId": "uuid-project-id",
  "query": "context transcendence implementation",
  "limit": 10,
  "timeframe": "7d"
}
```

#### Respuesta de Búsqueda
```json
{
  "context": "Recent relevant context...\n\n",
  "metadata": {
    "sources": 5,
    "insights": 2,
    "relevanceScore": 0.89
  },
  "insights": [
    {
      "type": "project",
      "summary": "Current project phase: Infrastructure setup",
      "confidence": 0.92
    }
  ]
}
```

---

## 🛠️ Gestión de Servicios

### Comandos Útiles

```bash
# Iniciar toda la infraestructura
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f context-capture

# Reiniciar un servicio
docker-compose restart context-capture

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (CUIDADO: elimina datos)
docker-compose down -v
```

### Monitoreo de Salud

```bash
# Health check completo
./scripts/setup/setup-context-infrastructure.sh health

# Verificar individualmente
curl http://localhost:8001/health | jq
curl http://localhost:8002/health | jq
curl http://localhost:8003/health | jq
curl http://localhost:8004/health | jq
```

---

## 📈 Ejemplo de Uso

### 1. Capturar Contexto de Conversación

```javascript
// Ejemplo en JavaScript
const contextEvent = {
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  sessionId: "session-001",
  actorId: "user-alice",
  type: "conversational",
  content: "Let's implement vector similarity search for context retrieval. This will enable semantic search across conversation history."
};

const response = await fetch('http://localhost:8001/api/v2/context/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(contextEvent)
});

const result = await response.json();
console.log('Event processed:', result.eventId);
```

### 2. Recuperar Contexto Relevante

```javascript
const searchQuery = {
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  query: "vector similarity search context retrieval",
  limit: 5,
  includeInsights: true
};

const searchResponse = await fetch('http://localhost:8003/api/v2/context/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(searchQuery)
});

const searchResult = await searchResponse.json();
console.log('Retrieved context:', searchResult.context);
```

### 3. Obtener Estadísticas del Proyecto

```bash
curl "http://localhost:8001/api/v2/context/stats?projectId=550e8400-e29b-41d4-a716-446655440000&timeframe=7d"
```

```json
{
  "total_events": 156,
  "unique_sessions": 12,
  "unique_actors": 3,
  "avg_context_score": 0.72,
  "conversational_events": 89,
  "decision_events": 23,
  "action_events": 44
}
```

---

## 🔧 Configuración Avanzada

### Optimización de PostgreSQL + pgvector

```sql
-- Configurar parámetros para vector operations
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';

-- Índice optimizado para vector similarity
CREATE INDEX idx_context_events_vector_optimized 
ON iris_context_events USING ivfflat (semantic_vector vector_cosine_ops) 
WITH (lists = 100);
```

### Configuración de Neo4j

```yaml
# docker-compose.yml overrides
neo4j:
  environment:
    - NEO4J_dbms_memory_heap_initial__size=2g
    - NEO4J_dbms_memory_heap_max__size=4g
    - NEO4J_dbms_memory_pagecache_size=1g
    - NEO4J_dbms_transaction_timeout=300s
```

### Kafka Topic Configuration

```bash
# Modificar retención de topics para desarrollo
export KAFKA_RETENTION_MS=864000000  # 10 días
export KAFKA_RETENTION_BYTES=1073741824  # 1GB

# Reconfigurar topics existentes
docker exec iris-kafka kafka-configs --bootstrap-server localhost:9092 \
  --alter --entity-type topics --entity-name iris.context.events \
  --add-config retention.ms=864000000
```

---

## 🔍 Troubleshooting

### Problemas Comunes

#### 1. **PostgreSQL no inicia**
```bash
# Verificar logs
docker-compose logs postgres

# Reiniciar con limpieza
docker-compose down -v
docker-compose up -d postgres
```

#### 2. **pgvector no disponible**
```bash
# Verificar extensión
docker exec iris-postgres-v2 psql -U iris_user -d iris_context_db -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# Instalar manualmente
docker exec iris-postgres-v2 psql -U iris_user -d iris_context_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### 3. **OpenAI API errores**
```bash
# Verificar API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Verificar logs del servicio
docker-compose logs context-capture | grep -i "openai\|error"
```

#### 4. **Kafka topics no se crean**
```bash
# Verificar estado de Kafka
docker exec iris-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Recrear topics manualmente
docker exec iris-kafka kafka-topics --create \
  --topic iris.context.events \
  --bootstrap-server localhost:9092 \
  --partitions 6 --replication-factor 1
```

### Logs y Debugging

```bash
# Ver logs de todos los servicios
docker-compose logs --tail=100

# Ver logs en tiempo real de un servicio
docker-compose logs -f context-capture

# Acceder a contenedor específico
docker exec -it iris-context-capture /bin/sh

# Verificar conectividad entre servicios
docker exec iris-context-capture ping neo4j
docker exec iris-context-capture ping postgres
```

---

## 📊 Métricas de Performance

### Benchmarks Esperados

| Métrica | Baseline | Target | Actual |
|---------|----------|--------|--------|
| **Event Processing** | - | <500ms | - |
| **Vector Search** | - | <200ms | - |
| **Context Relevance** | - | >85% | - |
| **Throughput** | - | 1000 events/min | - |
| **Uptime** | - | 99.9% | - |

### Monitoreo

```bash
# Métricas de PostgreSQL
docker exec iris-postgres-v2 psql -U iris_user -d iris_context_db -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables
ORDER BY schemaname, tablename;
"

# Métricas de Redis
docker exec iris-redis-v2 redis-cli info stats

# Métricas de Kafka
docker exec iris-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

---

## 🗂️ Estructura de Archivos

```
iris-v2.0/context-infrastructure/
├── docker-compose.yml              # Orquestación principal
├── .env                           # Variables de entorno
├── README.md                      # Esta documentación
├── database/
│   ├── migrations/
│   │   └── 001_create_context_schema.sql
│   └── init/
│       └── 01_init_context_database.sh
├── services/
│   ├── context-capture/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── index.js
│   ├── context-processing/
│   ├── context-retrieval/
│   └── memory-management/
├── config/
│   ├── kafka/
│   │   └── kafka-config.yml
│   ├── postgres/
│   ├── neo4j/
│   └── redis/
└── scripts/
    ├── setup/
    │   └── setup-context-infrastructure.sh
    ├── migration/
    └── deployment/
```

---

## 🎯 Próximos Pasos

### Fase 1 Completada ✅
- [x] Infraestructura de base de datos
- [x] Context Capture Service
- [x] Vector similarity search
- [x] Kafka event streaming
- [x] API endpoints básicos

### Fase 2: Próximas Implementaciones
1. **MCP Integration** - Model Context Protocol compliance
2. **Project Organization** - Context isolation per project
3. **Multi-Agent System** - Enhanced agent architecture
4. **Context Transcendence** - Cross-session continuity
5. **Advanced Features** - Multi-modal context, optimization

---

## 💬 Soporte

### Documentación Adicional
- [IRIS v2.0 Arquitectura Completa](../docs/architecture.md)
- [Context Transcendence Theory](../docs/context-transcendence.md)
- [API Reference](../docs/api-reference.md)

### Contacto
- **Autor**: MiniMax Agent
- **Proyecto**: IRIS v2.0 Context Memory Infrastructure
- **Versión**: 2.0.0
- **Fecha**: 2025-11-10

---

**🎉 ¡La infraestructura de Context Memory está lista para implementar Context Transcendence en IRIS v2.0!**