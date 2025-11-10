#!/usr/bin/env node
/**
 * CONTEXT BRIDGE SERVICE
 * Adaptador principal entre IRIS Code Enhanced y Context Memory Infrastructure
 * 
 * Responsabilidades:
 * - Conectar equipos especializados con Context Memory
 * - Gestionar sesiones y contexto trans-sesional
 * - Optimizar rendimiento con cache inteligente
 * - Proveer API unificada para equipos context-aware
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const Redis = require('ioredis');
const { Pool } = require('pg');
const winston = require('winston');

class ContextBridgeService {
    constructor() {
        this.app = express();
        this.port = process.env.CONTEXT_BRIDGE_PORT || 8104;
        this.running = false;
        
        // URLs de servicios
        this.services = {
            contextCapture: process.env.CONTEXT_CAPTURE_URL || 'http://context-capture:8001',
            contextRetrieval: process.env.CONTEXT_RETRIEVAL_URL || 'http://context-retrieval:8003',
            memoryManagement: process.env.MEMORY_MANAGEMENT_URL || 'http://memory-management:8004'
        };
        
        // Cliente Redis para cache
        this.redis = new Redis({
            host: 'iris-redis-context',
            port: 6379,
            password: 'RedisSecure2025@Context',
            retryDelayOnFailover: 100,
            enableOfflineQueue: false,
        });
        
        // Pool de PostgreSQL para consultas directas
        this.pgPool = new Pool({
            connectionString: 'postgresql://iris_user:IrisSecure2025@iris-postgres-context:5432/iris_context_db',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        // Configuración de logging
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'context-bridge' },
            transports: [
                new winston.transports.File({ filename: 'logs/context-bridge/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/context-bridge/combined.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });
        
        // Estadísticas del servicio
        this.stats = {
            requests: 0,
            responses: 0,
            cache_hits: 0,
            cache_misses: 0,
            context_captures: 0,
            context_retrievals: 0,
            average_response_time: 0
        };
        
        this.initializeMiddleware();
        this.setupRoutes();
        this.startHealthChecks();
    }
    
    initializeMiddleware() {
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));
        
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true
        }));
        
        this.app.use(morgan('combined'));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Middleware de estadísticas
        this.app.use((req, res, next) => {
            const start = Date.now();
            this.stats.requests++;
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.stats.responses++;
                this.updateAverageResponseTime(duration);
            });
            
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    service: 'Context Bridge Service',
                    version: '2.0.0',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    services: {},
                    stats: this.stats
                };
                
                // Verificar conectividad con servicios de contexto
                for (const [name, url] of Object.entries(this.services)) {
                    try {
                        const response = await axios.get(`${url}/health`, { timeout: 5000 });
                        health.services[name] = { status: 'healthy', response_time: response.headers['x-response-time'] || 'N/A' };
                    } catch (error) {
                        health.services[name] = { status: 'unhealthy', error: error.message };
                    }
                }
                
                res.json(health);
            } catch (error) {
                this.logger.error('Health check failed:', error);
                res.status(503).json({ status: 'unhealthy', error: error.message });
            }
        });
        
        // Estadísticas del servicio
        this.app.get('/stats', (req, res) => {
            res.json({
                service: 'Context Bridge',
                stats: this.stats,
                cache: {
                    hits: this.stats.cache_hits,
                    misses: this.stats.cache_misses,
                    hit_rate: this.stats.requests > 0 ? (this.stats.cache_hits / this.stats.requests * 100).toFixed(2) + '%' : '0%'
                }
            });
        });
        
        // =============================================================================
        // API PARA EQUIPOS - CAPTURAR CONTEXTO
        // =============================================================================
        
        /**
         * POST /api/v2/context/capture
         * Captura y almacena contexto de tareas de equipos
         */
        this.app.post('/api/v2/context/capture', async (req, res) => {
            try {
                const { teamId, sessionId, taskType, taskData, result, priority = 'normal' } = req.body;
                
                if (!teamId || !sessionId || !taskType) {
                    return res.status(400).json({ error: 'teamId, sessionId, and taskType are required' });
                }
                
                const contextData = {
                    team_id: teamId,
                    session_id: sessionId,
                    task_type: taskType,
                    task_data: taskData,
                    result: result,
                    priority: priority,
                    timestamp: new Date().toISOString()
                };
                
                // Llamar al servicio de captura
                const response = await axios.post(`${this.services.contextCapture}/api/v2/context/events`, contextData);
                
                this.stats.context_captures++;
                
                // Cache el resultado para consultas futuras
                const cacheKey = `context:${teamId}:${sessionId}:${taskType}`;
                await this.redis.setex(cacheKey, 3600, JSON.stringify(contextData));
                
                this.logger.info(`Context captured for team ${teamId}, session ${sessionId}`);
                
                res.json({
                    success: true,
                    context_id: response.data.context_id,
                    message: 'Context captured successfully'
                });
                
            } catch (error) {
                this.logger.error('Context capture failed:', error);
                res.status(500).json({ error: 'Failed to capture context', details: error.message });
            }
        });
        
        // =============================================================================
        // API PARA EQUIPOS - RECUPERAR CONTEXTO
        // =============================================================================
        
        /**
         * GET /api/v2/context/retrieve
         * Recupera contexto relevante para equipos
         */
        this.app.get('/api/v2/context/retrieve', async (req, res) => {
            try {
                const { teamId, sessionId, query, limit = 10 } = req.query;
                
                if (!teamId) {
                    return res.status(400).json({ error: 'teamId is required' });
                }
                
                // Verificar cache primero
                const cacheKey = `context:${teamId}:${query || 'recent'}`;
                const cached = await this.redis.get(cacheKey);
                
                if (cached) {
                    this.stats.cache_hits++;
                    return res.json({
                        success: true,
                        source: 'cache',
                        data: JSON.parse(cached)
                    });
                }
                
                this.stats.cache_misses++;
                
                // Llamar al servicio de recuperación
                const params = { team_id: teamId, limit: limit.toString() };
                if (query) params.query = query;
                if (sessionId) params.session_id = sessionId;
                
                const response = await axios.get(`${this.services.contextRetrieval}/api/v2/context/retrieve`, { params });
                
                this.stats.context_retrievals++;
                
                // Cache el resultado
                await this.redis.setex(cacheKey, 1800, JSON.stringify(response.data));
                
                res.json({
                    success: true,
                    source: 'database',
                    data: response.data
                });
                
            } catch (error) {
                this.logger.error('Context retrieval failed:', error);
                res.status(500).json({ error: 'Failed to retrieve context', details: error.message });
            }
        });
        
        // =============================================================================
        // API PARA EQUIPOS - BÚSQUEDA SEMÁNTICA
        // =============================================================================
        
        /**
         * POST /api/v2/context/semantic-search
         * Búsqueda semántica en el contexto usando pgvector
         */
        this.app.post('/api/v2/context/semantic-search', async (req, res) => {
            try {
                const { query, teamId, sessionId, threshold = 0.7, limit = 10 } = req.body;
                
                if (!query) {
                    return res.status(400).json({ error: 'query is required' });
                }
                
                // Usar búsqueda vectorial directa en PostgreSQL
                const searchQuery = `
                    SELECT 
                        id, team_id, session_id, task_type, task_data, result,
                        similarity(embedding, openai_embeddings($1)) as similarity_score
                    FROM iris_context_events 
                    WHERE team_id = COALESCE($2, team_id)
                    AND similarity(embedding, openai_embeddings($1)) > $3
                    ORDER BY similarity(embedding, openai_embeddings($1)) DESC
                    LIMIT $4
                `;
                
                const values = [query, teamId || null, threshold, limit];
                const client = await this.pgPool.connect();
                
                try {
                    const result = await client.query(searchQuery, values);
                    
                    const contexts = result.rows.map(row => ({
                        id: row.id,
                        team_id: row.team_id,
                        session_id: row.session_id,
                        task_type: row.task_type,
                        task_data: row.task_data,
                        result: row.result,
                        similarity_score: parseFloat(row.similarity_score)
                    }));
                    
                    res.json({
                        success: true,
                        query: query,
                        results: contexts,
                        count: contexts.length
                    });
                    
                } finally {
                    client.release();
                }
                
            } catch (error) {
                this.logger.error('Semantic search failed:', error);
                res.status(500).json({ error: 'Failed to perform semantic search', details: error.message });
            }
        });
        
        // =============================================================================
        // API PARA EQUIPOS - CONTEXTO TRANS-SESIONAL
        // =============================================================================
        
        /**
         * GET /api/v2/context/transsession/{teamId}
         * Recupera contexto histórico de un equipo a través de sesiones
         */
        this.app.get('/api/v2/context/transsession/:teamId', async (req, res) => {
            try {
                const { teamId } = req.params;
                const { limit = 20, days = 30 } = req.query;
                
                const transSessionQuery = `
                    SELECT 
                        session_id, COUNT(*) as event_count,
                        MAX(timestamp) as last_activity,
                        string_agg(DISTINCT task_type, ', ') as task_types,
                        AVG(similarity(embedding, openai_embeddings(''))) as avg_relevance
                    FROM iris_context_events 
                    WHERE team_id = $1 
                    AND timestamp > NOW() - INTERVAL '${parseInt(days)} days'
                    GROUP BY session_id
                    ORDER BY last_activity DESC
                    LIMIT $2
                `;
                
                const client = await this.pgPool.connect();
                
                try {
                    const result = await client.query(transSessionQuery, [teamId, parseInt(limit)]);
                    
                    const sessions = result.rows.map(row => ({
                        session_id: row.session_id,
                        event_count: parseInt(row.event_count),
                        last_activity: row.last_activity,
                        task_types: row.task_types.split(', '),
                        avg_relevance: parseFloat(row.avg_relevance) || 0
                    }));
                    
                    res.json({
                        success: true,
                        team_id: teamId,
                        sessions: sessions,
                        total_sessions: sessions.length
                    });
                    
                } finally {
                    client.release();
                }
                
            } catch (error) {
                this.logger.error('Trans-sessional context retrieval failed:', error);
                res.status(500).json({ error: 'Failed to retrieve trans-sessional context', details: error.message });
            }
        });
        
        // =============================================================================
        // API PARA EQUIPOS - OPTIMIZACIÓN INTELIGENTE
        // =============================================================================
        
        /**
         * GET /api/v2/context/optimize/{teamId}
         * Analiza patrones de uso y sugiere optimizaciones
         */
        this.app.get('/api/v2/context/optimize/:teamId', async (req, res) => {
            try {
                const { teamId } = req.params;
                
                const optimizationQuery = `
                    WITH team_stats AS (
                        SELECT 
                            task_type,
                            COUNT(*) as usage_count,
                            AVG(similarity(embedding, openai_embeddings(''))) as avg_relevance,
                            COUNT(DISTINCT session_id) as unique_sessions
                        FROM iris_context_events 
                        WHERE team_id = $1 
                        AND timestamp > NOW() - INTERVAL '7 days'
                        GROUP BY task_type
                    )
                    SELECT 
                        task_type,
                        usage_count,
                        avg_relevance,
                        unique_sessions,
                        CASE 
                            WHEN usage_count > 10 AND avg_relevance > 0.6 THEN 'high_priority'
                            WHEN usage_count > 5 AND avg_relevance > 0.4 THEN 'medium_priority'
                            ELSE 'low_priority'
                        END as priority_level
                    FROM team_stats
                    ORDER BY usage_count DESC, avg_relevance DESC
                `;
                
                const client = await this.pgPool.connect();
                
                try {
                    const result = await client.query(optimizationQuery, [teamId]);
                    
                    const analysis = {
                        team_id: teamId,
                        analysis_date: new Date().toISOString(),
                        total_task_types: result.rows.length,
                        patterns: result.rows.map(row => ({
                            task_type: row.task_type,
                            usage_count: parseInt(row.usage_count),
                            avg_relevance: parseFloat(row.avg_relevance),
                            unique_sessions: parseInt(row.unique_sessions),
                            priority_level: row.priority_level
                        })),
                        recommendations: this.generateRecommendations(result.rows)
                    };
                    
                    res.json({
                        success: true,
                        analysis: analysis
                    });
                    
                } finally {
                    client.release();
                }
                
            } catch (error) {
                this.logger.error('Optimization analysis failed:', error);
                res.status(500).json({ error: 'Failed to perform optimization analysis', details: error.message });
            }
        });
    }
    
    generateRecommendations(stats) {
        const recommendations = [];
        
        const highUsage = stats.filter(s => s.usage_count > 10);
        const lowRelevance = stats.filter(s => parseFloat(s.avg_relevance) < 0.4);
        
        if (highUsage.length > 0) {
            recommendations.push({
                type: 'high_frequency',
                message: `Team has ${highUsage.length} high-frequency task types. Consider caching common patterns.`,
                priority: 'medium'
            });
        }
        
        if (lowRelevance.length > 0) {
            recommendations.push({
                type: 'low_relevance',
                message: `Found ${lowRelevance.length} task types with low semantic relevance. Review task categorization.`,
                priority: 'high'
            });
        }
        
        if (stats.length === 0) {
            recommendations.push({
                type: 'no_data',
                message: 'No recent context data found. Consider encouraging context capture for better performance.',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }
    
    updateAverageResponseTime(newTime) {
        // Calcular promedio móvil
        this.stats.average_response_time = (this.stats.average_response_time * 0.9) + (newTime * 0.1);
    }
    
    startHealthChecks() {
        // Verificar salud cada 30 segundos
        setInterval(async () => {
            try {
                // Verificar conectividad con Redis
                await this.redis.ping();
                
                // Verificar conectividad con PostgreSQL
                const client = await this.pgPool.connect();
                await client.query('SELECT 1');
                client.release();
                
            } catch (error) {
                this.logger.error('Health check failed:', error);
            }
        }, 30000);
    }
    
    async start() {
        try {
            // Crear directorio de logs
            require('fs').mkdirSync('logs/context-bridge', { recursive: true });
            
            this.server = this.app.listen(this.port, '0.0.0.0', () => {
                this.running = true;
                this.logger.info(`Context Bridge Service started on port ${this.port}`);
                this.logger.info('Connected to Context Memory Infrastructure');
                console.log(`🔗 Context Bridge Service running on port ${this.port}`);
            });
            
        } catch (error) {
            this.logger.error('Failed to start Context Bridge Service:', error);
            throw error;
        }
    }
    
    async stop() {
        if (this.running) {
            if (this.server) {
                this.server.close();
            }
            if (this.redis) {
                await this.redis.quit();
            }
            if (this.pgPool) {
                await this.pgPool.end();
            }
            this.running = false;
            this.logger.info('Context Bridge Service stopped');
        }
    }
}

// Inicializar y ejecutar el servicio
if (require.main === module) {
    const bridge = new ContextBridgeService();
    
    bridge.start().catch(error => {
        console.error('Failed to start Context Bridge Service:', error);
        process.exit(1);
    });
    
    // Manejo graceful de cierre
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully');
        await bridge.stop();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully');
        await bridge.stop();
        process.exit(0);
    });
}

module.exports = ContextBridgeService;