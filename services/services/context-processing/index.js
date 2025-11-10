#!/usr/bin/env node
/**
 * CONTEXT PROCESSING SERVICE
 * Pipeline de procesamiento de contexto con IA
 * 
 * Responsabilidades:
 * - Generar embeddings semánticos con OpenAI
 * - Análisis de sentimientos y clasificación
 * - Extracción de entidades clave
 * - Optimización y enrichment del contexto
 * - Almacenamiento optimizado en PostgreSQL+pgvector
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const { Pool } = require('pg');
const natural = require('natural');
const OpenAI = require('openai');
const cron = require('node-cron');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

class ContextProcessingService {
    constructor() {
        this.app = express();
        this.port = process.env.CONTEXT_PROCESSING_PORT || 8102;
        this.running = false;
        
        // Cliente OpenAI para embeddings
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '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'
        });
        
        // Configuración de base de datos
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://iris_user:IrisSecure2025@iris-postgres-context:5432/iris_context_db',
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
            defaultMeta: { service: 'context-processing' },
            transports: [
                new winston.transports.File({ filename: 'logs/context-processing/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/context-processing/combined.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });
        
        // Procesador de lenguaje natural
        this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
        this.tokenizer = new natural.WordTokenizer();
        
        this.initializeMiddleware();
        this.setupRoutes();
        this.startProcessingQueue();
        this.startHealthChecks();
    }
    
    initializeMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(morgan('combined'));
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                service: 'context-processing',
                timestamp: new Date().toISOString()
            });
        });
        
        // Procesar contexto
        this.app.post('/process', async (req, res) => {
            try {
                const { contextData, priority = 'normal' } = req.body;
                
                this.logger.info('Processing context', { 
                    contextId: contextData?.id,
                    priority,
                    contentLength: contextData?.content?.length 
                });
                
                // Procesar el contexto
                const processedContext = await this.processContext(contextData);
                
                // Almacenar en base de datos
                await this.storeProcessedContext(processedContext);
                
                res.json({
                    success: true,
                    processedContext: {
                        id: processedContext.id,
                        originalId: contextData.id,
                        sentiment: processedContext.sentiment,
                        entities: processedContext.entities,
                        summary: processedContext.summary,
                        embeddingSize: processedContext.embedding?.length
                    }
                });
                
            } catch (error) {
                this.logger.error('Error processing context', { error: error.message });
                res.status(500).json({ 
                    error: 'Context processing failed',
                    message: error.message 
                });
            }
        });
        
        // Batch processing
        this.app.post('/process-batch', async (req, res) => {
            try {
                const { contexts, priority = 'normal' } = req.body;
                
                this.logger.info('Processing context batch', { 
                    count: contexts.length,
                    priority 
                });
                
                const results = [];
                for (const context of contexts) {
                    try {
                        const processed = await this.processContext(context);
                        await this.storeProcessedContext(processed);
                        results.push({
                            id: context.id,
                            success: true,
                            processed: {
                                id: processed.id,
                                sentiment: processed.sentiment,
                                entities: processed.entities,
                                summary: processed.summary
                            }
                        });
                    } catch (error) {
                        this.logger.error('Error processing context in batch', { 
                            contextId: context.id,
                            error: error.message 
                        });
                        results.push({
                            id: context.id,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                res.json({
                    success: true,
                    results,
                    total: contexts.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length
                });
                
            } catch (error) {
                this.logger.error('Error in batch processing', { error: error.message });
                res.status(500).json({ 
                    error: 'Batch processing failed',
                    message: error.message 
                });
            }
        });
        
        // Statistics
        this.app.get('/stats', async (req, res) => {
            try {
                const stats = await this.getProcessingStats();
                res.json(stats);
            } catch (error) {
                this.logger.error('Error getting stats', { error: error.message });
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
    }
    
    async processContext(contextData) {
        const startTime = Date.now();
        
        try {
            // 1. Generar embeddings semánticos
            const embedding = await this.generateEmbedding(contextData.content);
            
            // 2. Análisis de sentimientos
            const sentiment = this.analyzeSentiment(contextData.content);
            
            // 3. Extracción de entidades
            const entities = this.extractEntities(contextData.content);
            
            // 4. Resumen inteligente
            const summary = await this.generateSummary(contextData.content);
            
            // 5. Palabras clave
            const keywords = this.extractKeywords(contextData.content);
            
            const processedContext = {
                id: uuidv4(),
                originalId: contextData.id,
                content: contextData.content,
                metadata: {
                    ...contextData.metadata,
                    processingTimestamp: new Date().toISOString(),
                    processingDuration: Date.now() - startTime,
                    contentLength: contextData.content.length
                },
                embedding: embedding,
                sentiment: sentiment,
                entities: entities,
                summary: summary,
                keywords: keywords,
                processedAt: new Date().toISOString()
            };
            
            this.logger.info('Context processed successfully', { 
                contextId: contextData.id,
                processingTime: Date.now() - startTime,
                entityCount: entities.length,
                keywordCount: keywords.length
            });
            
            return processedContext;
            
        } catch (error) {
            this.logger.error('Error in processContext', { 
                contextId: contextData.id,
                error: error.message 
            });
            throw error;
        }
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
            // Fallback a un embedding simple
            return new Array(1536).fill(0);
        }
    }
    
    analyzeSentiment(text) {
        try {
            const tokens = this.tokenizer.tokenize(text.toLowerCase());
            const score = this.sentimentAnalyzer.getSentiment(tokens);
            
            return {
                score: score,
                label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
                confidence: Math.abs(score)
            };
        } catch (error) {
            this.logger.error('Error analyzing sentiment', { error: error.message });
            return { score: 0, label: 'neutral', confidence: 0 };
        }
    }
    
    extractEntities(text) {
        try {
            // Extracción básica de entidades
            const entityRegex = {
                organizations: /\b[A-Z][a-zA-Z\s&]*\b(?:\s(Inc|LLC|Corp|Corporation|Company|Ltd|Limited))\b/g,
                people: /\b[A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+\b/g,
                emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
                urls: /https?:\/\/[^\s]+/g,
                dates: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g
            };
            
            const entities = [];
            
            for (const [type, regex] of Object.entries(entityRegex)) {
                const matches = text.match(regex) || [];
                matches.forEach(match => {
                    entities.push({
                        type,
                        value: match,
                        confidence: type === 'emails' || type === 'urls' ? 0.9 : 0.7
                    });
                });
            }
            
            return entities;
        } catch (error) {
            this.logger.error('Error extracting entities', { error: error.message });
            return [];
        }
    }
    
    async generateSummary(text) {
        try {
            // Resumen simple con OpenAI
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that creates concise summaries. Provide a 1-2 sentence summary of the following text."
                    },
                    {
                        role: "user",
                        content: text.substring(0, 3000) // Limit text length
                    }
                ],
                max_tokens: 100,
                temperature: 0.3
            });
            
            return response.choices[0].message.content.trim();
        } catch (error) {
            this.logger.error('Error generating summary', { error: error.message });
            // Fallback a resumen simple
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
            return sentences.length > 0 ? sentences.slice(0, 2).join('. ').trim() + '.' : text.substring(0, 200) + '...';
        }
    }
    
    extractKeywords(text) {
        try {
            const tokens = this.tokenizer.tokenize(text.toLowerCase());
            const filteredTokens = tokens.filter(token => 
                token.length > 3 && 
                !natural.stopwords.includes(token) && 
                /^[a-zA-Z]+$/.test(token)
            );
            
            const frequency = {};
            filteredTokens.forEach(token => {
                frequency[token] = (frequency[token] || 0) + 1;
            });
            
            return Object.entries(frequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20)
                .map(([word, count]) => ({ word, count }));
        } catch (error) {
            this.logger.error('Error extracting keywords', { error: error.message });
            return [];
        }
    }
    
    async storeProcessedContext(processedContext) {
        try {
            const query = `
                INSERT INTO processed_contexts (
                    id, original_id, content, metadata, embedding, 
                    sentiment_score, sentiment_label, entities, summary, 
                    keywords, processed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;
            
            const values = [
                processedContext.id,
                processedContext.originalId,
                processedContext.content,
                JSON.stringify(processedContext.metadata),
                `[${processedContext.embedding}]`,
                processedContext.sentiment.score,
                processedContext.sentiment.label,
                JSON.stringify(processedContext.entities),
                processedContext.summary,
                JSON.stringify(processedContext.keywords),
                processedContext.processedAt
            ];
            
            await this.pgPool.query(query, values);
            
            this.logger.info('Processed context stored', { 
                processedId: processedContext.id,
                originalId: processedContext.originalId
            });
            
        } catch (error) {
            this.logger.error('Error storing processed context', { 
                error: error.message,
                processedId: processedContext.id
            });
            throw error;
        }
    }
    
    async getProcessingStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_processed,
                    AVG(EXTRACT(EPOCH FROM (processed_at - NOW()))) * -1 as avg_processing_time,
                    COUNT(DISTINCT sentiment_label) as unique_sentiments,
                    COUNT(DISTINCT entity_type) as unique_entity_types
                FROM processed_contexts 
                WHERE processed_at > NOW() - INTERVAL '24 hours'
            `;
            
            const result = await this.pgPool.query(query);
            
            return {
                service: 'context-processing',
                timestamp: new Date().toISOString(),
                stats: result.rows[0]
            };
        } catch (error) {
            this.logger.error('Error getting processing stats', { error: error.message });
            return {
                service: 'context-processing',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    startProcessingQueue() {
        // Programar procesamiento automático cada 5 minutos
        cron.schedule('*/5 * * * *', async () => {
            try {
                this.logger.info('Running scheduled context processing');
                // Aquí se pueden procesar contextos pendientes
            } catch (error) {
                this.logger.error('Error in scheduled processing', { error: error.message });
            }
        });
    }
    
    startHealthChecks() {
        setInterval(async () => {
            try {
                await this.pgPool.query('SELECT 1');
            } catch (error) {
                this.logger.error('Health check failed', { error: error.message });
            }
        }, 60000); // Cada minuto
    }
    
    start() {
        if (this.running) {
            this.logger.warn('Service already running');
            return;
        }
        
        this.app.listen(this.port, () => {
            this.running = true;
            this.logger.info(`Context Processing Service started on port ${this.port}`);
        });
    }
}

// Iniciar el servicio si se ejecuta directamente
if (require.main === module) {
    const service = new ContextProcessingService();
    service.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down Context Processing Service...');
        process.exit(0);
    });
}

module.exports = ContextProcessingService;