#!/usr/bin/env node
/**
 * CONTEXT RETRIEVAL SERVICE
 * Servicio de recuperación de contexto con búsqueda semántica
 * 
 * Responsabilidades:
 * - Búsqueda semántica usando pgvector
 * - Filtrado y ranking de resultados
 * - Cache inteligente de consultas
 * - API de acceso al contexto histórico
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const Redis = require('ioredis');
const OpenAI = require('openai');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

class ContextRetrievalService {
    constructor() {
        this.app = express();
        this.port = process.env.CONTEXT_RETRIEVAL_PORT || 8103;
        this.running = false;
        
        // Cliente OpenAI para embeddings
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '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'
        });
        
        // Pool de PostgreSQL con pgvector
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://iris_user:IrisSecure2025@iris-postgres-context:5432/iris_context_db',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        // Cliente Redis para cache
        this.redis = new Redis({
            host: 'iris-redis-context',
            port: 6379,
            password: 'RedisSecure2025@Context',
            retryDelayOnFailover: 100,
            enableOfflineQueue: false,
        });
        
        // Configuración de logging
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'context-retrieval' },
            transports: [
                new winston.transports.File({ filename: 'logs/context-retrieval/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/context-retrieval/combined.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });
        
        this.initializeMiddleware();
        this.setupRoutes();
        this.startHealthChecks();
    }
    
    initializeMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '5mb' }));
        this.app.use(morgan('combined'));
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                service: 'context-retrieval',
                timestamp: new Date().toISOString()
            });
        });
        
        // Búsqueda semántica principal
        this.app.post('/search', async (req, res) => {
            try {
                const { 
                    query, 
                    limit = 10, 
                    threshold = 0.7,
                    filters = {},
                    searchType = 'semantic'
                } = req.body;
                
                this.logger.info('Semantic search requested', { 
                    query: query.substring(0, 100),
                    limit,
                    searchType 
                });
                
                // Verificar cache
                const cacheKey = this.generateCacheKey(query, filters);
                const cachedResults = await this.redis.get(cacheKey);
                
                if (cachedResults) {
                    this.logger.info('Returning cached search results', { 
                        cacheKey,
                        query: query.substring(0, 50)
                    });
                    return res.json({
                        success: true,
                        cached: true,
                        results: JSON.parse(cachedResults),
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Generar embedding para la consulta
                const queryEmbedding = await this.generateEmbedding(query);
                
                // Realizar búsqueda semántica
                const results = await this.performSemanticSearch(
                    queryEmbedding, 
                    limit, 
                    threshold, 
                    filters
                );
                
                // Cachear resultados
                await this.redis.setex(cacheKey, 3600, JSON.stringify(results));
                
                res.json({
                    success: true,
                    cached: false,
                    results,
                    total: results.length,
                    query: query,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Error in semantic search', { error: error.message });
                res.status(500).json({ 
                    error: 'Semantic search failed',
                    message: error.message 
                });
            }
        });
        
        // Búsqueda por similitud
        this.app.post('/similarity', async (req, res) => {
            try {
                const { contextId, limit = 5, minSimilarity = 0.8 } = req.body;
                
                this.logger.info('Similarity search requested', { 
                    contextId,
                    limit,
                    minSimilarity 
                });
                
                // Obtener embedding del contexto original
                const originalContext = await this.getContextById(contextId);
                if (!originalContext) {
                    return res.status(404).json({ error: 'Context not found' });
                }
                
                // Buscar contextos similares
                const similarResults = await this.findSimilarContexts(
                    originalContext.embedding,
                    limit,
                    minSimilarity,
                    { excludeId: contextId }
                );
                
                res.json({
                    success: true,
                    original: {
                        id: originalContext.id,
                        content: originalContext.content,
                        summary: originalContext.summary
                    },
                    similar: similarResults,
                    count: similarResults.length
                });
                
            } catch (error) {
                this.logger.error('Error in similarity search', { error: error.message });
                res.status(500).json({ 
                    error: 'Similarity search failed',
                    message: error.message 
                });
            }
        });
        
        // Filtrar por metadata
        this.app.post('/filter', async (req, res) => {
            try {
                const { 
                    filters = {}, 
                    sortBy = 'similarity',
                    limit = 20,
                    offset = 0 
                } = req.body;
                
                this.logger.info('Context filtering requested', { 
                    filters,
                    sortBy,
                    limit,
                    offset 
                });
                
                const results = await this.filterContexts(filters, sortBy, limit, offset);
                
                res.json({
                    success: true,
                    results,
                    total: results.length,
                    filters,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Error in context filtering', { error: error.message });
                res.status(500).json({ 
                    error: 'Context filtering failed',
                    message: error.message 
                });
            }
        });
        
        // Obtener contexto por ID
        this.app.get('/context/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const context = await this.getContextById(id);
                
                if (!context) {
                    return res.status(404).json({ error: 'Context not found' });
                }
                
                res.json({
                    success: true,
                    context
                });
                
            } catch (error) {
                this.logger.error('Error getting context by ID', { error: error.message });
                res.status(500).json({ 
                    error: 'Failed to get context',
                    message: error.message 
                });
            }
        });
        
        // Estadísticas del servicio
        this.app.get('/stats', async (req, res) => {
            try {
                const stats = await this.getRetrievalStats();
                res.json(stats);
            } catch (error) {
                this.logger.error('Error getting retrieval stats', { error: error.message });
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
    }
    
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text
            });
            
            return response.data[0].embedding;
        } catch (error) {
            this.logger.error('Error generating embedding', { error: error.message });
            throw error;
        }
    }
    
    async performSemanticSearch(embedding, limit, threshold, filters) {
        try {
            let query = `
                SELECT 
                    id, original_id, content, summary, sentiment_label, 
                    entities, keywords, metadata, processed_at,
                    1 - (embedding <=> $1::vector) as similarity
                FROM processed_contexts
                WHERE 1 - (embedding <=> $1::vector) > $2
            `;
            
            const queryParams = [ `[${embedding}]`, threshold ];
            let paramIndex = 3;
            
            // Aplicar filtros
            if (filters.team) {
                query += ` AND metadata->>'team' = $${paramIndex}`;
                queryParams.push(filters.team);
                paramIndex++;
            }
            
            if (filters.project) {
                query += ` AND metadata->>'project' = $${paramIndex}`;
                queryParams.push(filters.project);
                paramIndex++;
            }
            
            if (filters.timeRange) {
                if (filters.timeRange.start) {
                    query += ` AND processed_at >= $${paramIndex}`;
                    queryParams.push(filters.timeRange.start);
                    paramIndex++;
                }
                if (filters.timeRange.end) {
                    query += ` AND processed_at <= $${paramIndex}`;
                    queryParams.push(filters.timeRange.end);
                    paramIndex++;
                }
            }
            
            // Ordenar por similitud y limitar
            query += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
            queryParams.push(limit);
            
            const result = await this.pgPool.query(query, queryParams);
            
            return result.rows.map(row => ({
                id: row.id,
                originalId: row.original_id,
                content: row.content,
                summary: row.summary,
                sentiment: row.sentiment_label,
                entities: row.entities,
                keywords: row.keywords,
                metadata: row.metadata,
                similarity: parseFloat(row.similarity),
                processedAt: row.processed_at
            }));
            
        } catch (error) {
            this.logger.error('Error in semantic search query', { error: error.message });
            throw error;
        }
    }
    
    async findSimilarContexts(embedding, limit, minSimilarity, options = {}) {
        try {
            let query = `
                SELECT 
                    id, original_id, content, summary, sentiment_label, 
                    entities, keywords, metadata, processed_at,
                    1 - (embedding <=> $1::vector) as similarity
                FROM processed_contexts
                WHERE 1 - (embedding <=> $1::vector) > $2
            `;
            
            const queryParams = [ `[${embedding}]`, minSimilarity ];
            let paramIndex = 3;
            
            if (options.excludeId) {
                query += ` AND id != $${paramIndex}`;
                queryParams.push(options.excludeId);
                paramIndex++;
            }
            
            query += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
            queryParams.push(limit);
            
            const result = await this.pgPool.query(query, queryParams);
            
            return result.rows.map(row => ({
                id: row.id,
                originalId: row.original_id,
                content: row.content,
                summary: row.summary,
                sentiment: row.sentiment_label,
                similarity: parseFloat(row.similarity),
                processedAt: row.processed_at
            }));
            
        } catch (error) {
            this.logger.error('Error finding similar contexts', { error: error.message });
            throw error;
        }
    }
    
    async filterContexts(filters, sortBy, limit, offset) {
        try {
            let whereConditions = [];
            const queryParams = [];
            let paramIndex = 1;
            
            if (filters.team) {
                whereConditions.push(`metadata->>'team' = $${paramIndex}`);
                queryParams.push(filters.team);
                paramIndex++;
            }
            
            if (filters.project) {
                whereConditions.push(`metadata->>'project' = $${paramIndex}`);
                queryParams.push(filters.project);
                paramIndex++;
            }
            
            if (filters.sentiment) {
                whereConditions.push(`sentiment_label = $${paramIndex}`);
                queryParams.push(filters.sentiment);
                paramIndex++;
            }
            
            if (filters.timeRange) {
                if (filters.timeRange.start) {
                    whereConditions.push(`processed_at >= $${paramIndex}`);
                    queryParams.push(filters.timeRange.start);
                    paramIndex++;
                }
                if (filters.timeRange.end) {
                    whereConditions.push(`processed_at <= $${paramIndex}`);
                    queryParams.push(filters.timeRange.end);
                    paramIndex++;
                }
            }
            
            let query = `
                SELECT 
                    id, original_id, content, summary, sentiment_label, 
                    entities, keywords, metadata, processed_at
                FROM processed_contexts
            `;
            
            if (whereConditions.length > 0) {
                query += ` WHERE ${whereConditions.join(' AND ')}`;
            }
            
            // Ordenar
            const orderBy = this.getOrderByClause(sortBy);
            query += ` ORDER BY ${orderBy}`;
            
            // Paginación
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            queryParams.push(limit, offset);
            
            const result = await this.pgPool.query(query, queryParams);
            
            return result.rows.map(row => ({
                id: row.id,
                originalId: row.original_id,
                content: row.content,
                summary: row.summary,
                sentiment: row.sentiment_label,
                entities: row.entities,
                keywords: row.keywords,
                metadata: row.metadata,
                processedAt: row.processed_at
            }));
            
        } catch (error) {
            this.logger.error('Error filtering contexts', { error: error.message });
            throw error;
        }
    }
    
    getOrderByClause(sortBy) {
        switch (sortBy) {
            case 'recency':
                return 'processed_at DESC';
            case 'similarity':
                return 'embedding <-> (SELECT embedding FROM processed_contexts LIMIT 1)';
            case 'sentiment':
                return 'sentiment_score DESC';
            case 'relevance':
            default:
                return 'processed_at DESC';
        }
    }
    
    async getContextById(id) {
        try {
            const query = `
                SELECT 
                    id, original_id, content, summary, sentiment_label, 
                    entities, keywords, metadata, processed_at, embedding
                FROM processed_contexts
                WHERE id = $1
            `;
            
            const result = await this.pgPool.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const row = result.rows[0];
            return {
                id: row.id,
                originalId: row.original_id,
                content: row.content,
                summary: row.summary,
                sentiment: row.sentiment_label,
                entities: row.entities,
                keywords: row.keywords,
                metadata: row.metadata,
                processedAt: row.processed_at,
                embedding: row.embedding
            };
            
        } catch (error) {
            this.logger.error('Error getting context by ID', { error: error.message, contextId: id });
            throw error;
        }
    }
    
    generateCacheKey(query, filters) {
        const filterString = Object.keys(filters)
            .sort()
            .map(key => `${key}:${filters[key]}`)
            .join('|');
        const combined = `${query.substring(0, 50)}:${filterString}`;
        return `search:${Buffer.from(combined).toString('base64').substring(0, 50)}`;
    }
    
    async getRetrievalStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_contexts,
                    COUNT(DISTINCT sentiment_label) as sentiment_types,
                    COUNT(DISTINCT metadata->>'team') as unique_teams,
                    COUNT(DISTINCT metadata->>'project') as unique_projects,
                    AVG(EXTRACT(EPOCH FROM (NOW() - processed_at))) * -1 as avg_age_hours
                FROM processed_contexts
            `;
            
            const result = await this.pgPool.query(query);
            
            return {
                service: 'context-retrieval',
                timestamp: new Date().toISOString(),
                stats: result.rows[0],
                cache: {
                    redis: 'connected',
                    keys: await this.redis.dbsize()
                }
            };
        } catch (error) {
            this.logger.error('Error getting retrieval stats', { error: error.message });
            return {
                service: 'context-retrieval',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    startHealthChecks() {
        setInterval(async () => {
            try {
                await this.pgPool.query('SELECT 1');
                await this.redis.ping();
            } catch (error) {
                this.logger.error('Health check failed', { error: error.message });
            }
        }, 30000); // Cada 30 segundos
    }
    
    start() {
        if (this.running) {
            this.logger.warn('Service already running');
            return;
        }
        
        this.app.listen(this.port, () => {
            this.running = true;
            this.logger.info(`Context Retrieval Service started on port ${this.port}`);
        });
    }
}

// Iniciar el servicio si se ejecuta directamente
if (require.main === module) {
    const service = new ContextRetrievalService();
    service.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down Context Retrieval Service...');
        process.exit(0);
    });
}

module.exports = ContextRetrievalService;