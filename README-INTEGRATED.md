# 🚀 IRIS Code + Silhouette V4.0 - Sistema Unificado

## 📋 Descripción

Sistema integrado que combina:
- **IRIS Code**: Sistema de fallback inteligente para APIs (Gemini → MiniMax → Llama → HuggingFace → Local)
- **Silhouette V4.0**: Framework empresarial con 78+ equipos especializados
- **API Gateway Unificado**: Punto de entrada único para todas las capacidades
- **Frontend Integrado**: Interface completa que aprovecha todas las funcionalidades

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (iris-agent)                    │
│                   Puerto 3001 (React/Vite)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 API GATEWAY UNIFICADO                       │
│                   Puerto 8020                               │
│  • Unifica todas las APIs                                   │
│  • Maneja autenticación y rate limiting                     │
│  • Cache inteligente                                        │
│  • Monitoreo centralizado                                   │
└─────┬─────────────┬─────────────┬─────────────┬─────────────┘
      │             │             │             │
┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│   FALLBACK│ │SILHOUETTE │ │   ASSETS  │ │    MCP    │
│  Server   │ │Orchestrator│ │  Server   │ │  Server   │
│ Port 8021 │ │ Port 8022 │ │ Port 8023 │ │ Port 8027 │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
      │             │             │             │
┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ IRIS Code │ │  78 Teams │ │Asset Gen  │ │   Chat &  │
│ Original  │ │Business/Tech│ │API        │ │Context    │
│Backend    │ │/Audiovisual│ │           │ │Management │
│Port 3000  │ │           │ │           │ │           │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
```

## 🎯 Características Principales

### 🧠 Sistema de Fallback Inteligente
- **Secuencia**: Gemini 2.0 → MiniMax M2 → Llama 3.1 → HuggingFace → Local
- **APIs**: OpenRouter, Freepik, VEO3, HuggingFace, OpenAI, Anthropic
- **Monitoreo**: Tasa de éxito, tiempo de respuesta, uso de créditos
- **Cache**: Redis para optimización de rendimiento

### 🏢 78+ Equipos Especializados
#### Equipos de Negocio (25+)
- Marketing Team
- Sales Team  
- Finance Team
- HR Team
- Legal Team
- Customer Success Team
- Product Management Team
- Strategy Team
- Analytics Team
- Operations Team

#### Equipos Técnicos (15+)
- Development Team
- DevOps Team
- QA Team
- Security Team
- Architecture Team
- Data Engineering Team
- Mobile Development Team
- Frontend Team
- Backend Team
- Cloud Infrastructure Team

#### Equipos Audiovisuales (15+)
- Video Production Team
- Image Editing Team
- Audio Production Team
- Animation Team
- UI/UX Design Team
- Branding Team
- Photography Team
- Live Streaming Team
- 3D Modeling Team
- Motion Graphics Team

#### Equipos de Workflows Dinámicos (23+)
- E-commerce Workflow Team
- SaaS Development Team
- Mobile App Development Team
- Web Development Team
- Content Creation Team
- Social Media Management Team
- SEO Optimization Team
- Email Marketing Team
- Lead Generation Team
- Customer Onboarding Team

### 🎨 Generación de Assets
- **Imágenes**: Freepik, VEO3, HuggingFace
- **Videos**: VEO3, D-ID, RunwayML
- **Documentos**: Reportes, presentaciones, contratos
- **Audio**: TTS, música, efectos
- **UI/UX**: Componentes, prototipos, diseños

### 💬 Chat Unificado
- Contexto persistente
- Streaming de respuestas
- Integración con MCP
- Soporte multimodal
- Memoria conversacional

## 🚀 Inicio Rápido

### Prerequisitos
- Docker y Docker Compose instalados
- Node.js 18+ (para desarrollo)
- 8GB+ RAM disponible
- Puertos 3000-3030, 8020-8030 disponibles

### Instalación
```bash
# Clonar el repositorio
git clone <repository-url>
cd iris-code-enhanced

# Hacer ejecutable el script de inicio
chmod +x start-unified-system.sh

# Ejecutar el sistema completo
./start-unified-system.sh
```

### Configuración de APIs
1. Copiar archivo de configuración:
```bash
cp .env.production.template .env.production
```

2. Configurar variables críticas:
```bash
# APIs principales
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# APIs de assets
FREEPIK_API_KEY=...
VEO3_API_KEY=...
HUGGINGFACE_TOKEN=...

# Base de datos
POSTGRES_USER=iris_user
POSTGRES_PASSWORD=IrisSecure2025@Production
POSTGRES_DB=iris_production_db

# Cache
REDIS_PASSWORD=RedisSecure2025@Cache
```

## 🔧 Endpoints Principales

### API Gateway (Puerto 8020)
```bash
# Health check
GET /health

# Status del sistema
GET /status

# Métricas unificadas
GET /api/metrics/unified

# LLM con fallback
POST /api/llm/generate
{
  "prompt": "Tu prompt aquí",
  "provider": "auto",
  "model": "meta-llama/llama-3.1-70b-instruct:free"
}

# Generación de imágenes
POST /api/images/generate
{
  "prompt": "Descripción de la imagen",
  "style": "professional",
  "category": "branding"
}

# Chat unificado
POST /api/chat
{
  "message": "Hola, ¿cómo estás?",
  "context": {},
  "stream": true
}

# Equipos disponibles
GET /api/teams

# Ejecutar equipo específico
POST /api/teams/marketing_team/execute
{
  "task": "create_campaign",
  "parameters": {...}
}

# Workflow empresarial
POST /api/workflows/execute
{
  "workflow": "complete_marketing_campaign",
  "parameters": {...}
}
```

### Servicios Individuales
```bash
# Fallback Server (8021)
GET /health
POST /llm/generate
POST /images/generate
GET /stats
GET /providers

# Silhouette Orchestrator (8022)
GET /health
GET /teams
POST /teams/:teamId/execute
POST /workflows/execute
GET /stats
GET /metrics

# Assets Server (8023)
GET /health
POST /generate/image
POST /generate/video
GET /assets/branding
GET /assets/marketing

# MCP Server (8027)
GET /health
POST /chat
GET /conversations
POST /context
```

## 🖥️ Acceso a Interfaces

### Frontend Principal
- **URL**: http://localhost:3001
- **Descripción**: Interface completa con dashboard unificado
- **Tecnologías**: React 18, TypeScript, Tailwind CSS, Vite

### Dashboard Unificado
- **Acceso**: http://localhost:3001/dashboard
- **Funciones**:
  - Monitoreo de métricas en tiempo real
  - Control de equipos Silhouette
  - Gestión de workflows
  - Visualización de assets generados
  - Estado de servicios backend

### API Documentation
- **Swagger UI**: http://localhost:8020/docs (si está configurado)
- **Health Checks**: http://localhost:8020/health

## 🛠️ Desarrollo

### Estructura de Directorios
```
iris-code-enhanced/
├── src/
│   ├── api-gateway/          # Gateway unificado
│   ├── fallback-server/      # Sistema de fallback original
│   ├── silhouette/           # Framework Silhouette V4.0
│   │   ├── orchestrator/     # Orquestador central
│   │   ├── planner/          # Planificador de workflows
│   │   └── teams/            # 78+ equipos especializados
│   └── assets/               # Generador de assets
├── config/                   # Configuraciones
├── docs/                     # Documentación
├── scripts/                  # Scripts de deployment
├── tests/                    # Tests automatizados
├── docker-compose.yml        # Orquestación principal
├── .env.production          # Variables de producción
└── start-unified-system.sh  # Script de inicio
```

### Comandos de Desarrollo
```bash
# Iniciar solo el gateway
cd src/api-gateway && npm start

# Iniciar fallback server
cd src/fallback-server && npm start

# Iniciar Silhouette orchestrator
cd src/silhouette/orchestrator && npm start

# Desarrollo del frontend
cd src/frontend && npm run dev

# Tests
npm test

# Build de producción
npm run build
```

## 📊 Monitoreo y Métricas

### Métricas Principales
- **Gateway**: Solicitudes, respuestas, errores, latencia
- **Fallback**: Providers activos, tasa de éxito, último fallback
- **Silhouette**: Equipos activos, workflows completados, recursos
- **Assets**: Imágenes/videos/documentos generados
- **Sistema**: Uptime, uso de CPU/memoria, conexiones activas

### Dashboards Disponibles
- **Grafana**: http://localhost:3000 (si está configurado)
- **Prometheus**: http://localhost:9090 (métricas)
- **Custom Dashboard**: http://localhost:3001/dashboard

### Logs Centralizados
```bash
# Ver logs del gateway
docker-compose logs -f api-gateway

# Ver logs de todos los servicios
docker-compose logs -f

# Logs específicos
docker-compose logs -f iris-fallback-server
docker-compose logs -f silhouette-orchestrator
```

## 🔐 Seguridad

### Características de Seguridad
- **Rate Limiting**: 1000 requests/15min por IP
- **CORS**: Configuración restrictiva de orígenes
- **Helmet**: Headers de seguridad HTTP
- **Authentication**: JWT tokens (configurable)
- **Input Validation**: Validación de parámetros
- **Error Handling**: Manejo seguro de errores
- **HTTPS**: Soporte para SSL/TLS (en producción)

### Variables de Seguridad
```bash
# JWT
JWT_SECRET=iris_jwt_production_secret_2025_secure

# Encriptación
ENCRYPTION_KEY=iris_encryption_key_production_32chars

# API Keys
API_KEY_SECRET=silhouette_integration_key_2025
```

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. Servicios no inician
```bash
# Verificar puertos
netstat -tlnp | grep :8020

# Verificar logs
docker-compose logs [service-name]

# Reiniciar servicios
docker-compose restart
```

#### 2. Frontend no conecta
```bash
# Verificar API Gateway
curl http://localhost:8020/health

# Verificar configuración
cat src/frontend/.env

# Limpiar cache
docker-compose exec iris-frontend npm run build
```

#### 3. APIs no responden
```bash
# Verificar variables de entorno
cat .env.production | grep API_KEY

# Test individual
curl -X POST http://localhost:8020/api/llm/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

#### 4. Performance issues
```bash
# Verificar recursos
docker stats

# Verificar Redis
docker-compose exec redis redis-cli ping

# Verificar PostgreSQL
docker-compose exec postgres psql -U iris_user -d iris_production_db -c "SELECT version();"
```

## 📈 Escalabilidad

### Configuraciones de Escalado
```yaml
# Docker Compose con replicas
api-gateway:
  deploy:
    replicas: 3
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
```

### Load Balancing
- **Nginx**: Balanceador de carga principal
- **Docker Swarm**: Orquestación de contenedores
- **Kubernetes**: Escalado automático (futuro)

### Optimizaciones
- **Cache Redis**: Cache distribuido
- **CDN**: Para assets estáticos
- **Database Sharding**: Para grandes volúmenes
- **Microservices**: Separación por dominio

## 🤝 Contribuir

### Guidelines
1. Fork del repositorio
2. Crear branch feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit changes: `git commit -am 'Agregar nueva funcionalidad'`
4. Push branch: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código
- **TypeScript**: Para type safety
- **ESLint**: Linting automático
- **Prettier**: Formateo de código
- **Jest**: Testing framework
- **Conventional Commits**: Formato de commits

## 📝 Changelog

### Versión 4.0.0 (Actual)
- ✅ Integración completa IRIS Code + Silhouette V4.0
- ✅ API Gateway unificado
- ✅ 78+ equipos especializados
- ✅ Sistema de fallback inteligente
- ✅ Frontend integrado
- ✅ Monitoreo centralizado
- ✅ Documentación completa

### Versión 3.x (Anterior)
- Sistema de fallback básico
- Integración parcial de APIs
- Frontend básico

## 📞 Soporte

### Contacto
- **Documentación**: Ver carpeta `docs/`
- **Issues**: GitHub Issues
- **Discord**: [Enlace al servidor]
- **Email**: support@iris-code.com

### Recursos
- **API Reference**: http://localhost:8020/api-docs
- **Examples**: Carpeta `examples/`
- **Tutorials**: Videos en YouTube
- **Blog**: Blog técnico

## 📄 Licencia

MIT License - Ver archivo LICENSE para detalles completos.

---

**Desarrollado por MiniMax Agent** | **Versión 4.0.0** | **2025**