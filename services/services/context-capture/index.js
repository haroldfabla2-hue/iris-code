const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('rate-limiter-flexible');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const Redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const moment = require('moment');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class ContextCaptureService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8001;
        this.setupMiddleware();
        this.initializeComponents();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security and logging
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));
        this.app.use(compression());
        this.app.use(morgan('combined'));

        // Rate limiting
        const rateLimiter = new rateLimit.RateLimiterRedis({
            storeClient: this.getRedisClient(),
            keyPrefix: 'context_capture_rl',
            points: 100, // Number of requests
            duration: 60, // Per 60 seconds
        });

        this.app.use(async (req, res, next) => {
            try {
                await rateLimiter.consume(req.ip);
                next();
            } catch (rejRes) {
                res.status(429).json({ error: 'Too Many Requests' });
            }
        });

        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    initializeComponents() {
        // Initialize logger
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'context-capture' },
            transports: [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // Initialize Kafka producer
        this.kafka = new Kafka({
            clientId: 'iris-context-capture',
            brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(',')
        });
        this.producer = this.kafka.producer({
            transactionalId: 'context-capture-transactional',
            maxInFlightRequests: 1,
            idempotent: true,
        });

        // Initialize database connection
        this.dbPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Initialize Redis client
        this.redis = this.getRedisClient();

        // Initialize OpenAI client
        this.openai = new (require('openai'))({
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.logger.info('Context Capture Service initialized successfully');
    }

    getRedisClient() {
        return Redis.createClient({
            url: process.env.REDIS_URL,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('The Redis server refused the connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });
    }

    async start() {
        try {
            // Connect to external services
            await this.producer.connect();
            await this.redis.connect();
            
            // Test database connection
            await this.dbPool.query('SELECT 1');
            
            this.logger.info('Context Capture Service started successfully');
            
            // Start Kafka consumer for error handling
            await this.startErrorConsumer();
            
            // Start health check cron job
            this.startHealthCheck();
            
            this.app.listen(this.port, () => {
                this.logger.info(`Context Capture Service listening on port ${this.port}`);
            });
            
        } catch (error) {
            this.logger.error('Failed to start Context Capture Service:', error);
            process.exit(1);
        }
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            const health = await this.checkHealth();
            res.status(health.status === 'healthy' ? 200 : 503).json(health);
        });

        // Context event capture endpoint
        this.app.post('/api/v2/context/events', async (req, res) => {
            try {
                const event = await this.processContextEvent(req.body);
                res.json({
                    success: true,
                    eventId: event.id,
                    processingTime: event.processingTime,
                    contextScore: event.contextScore,
                    insights: event.insights
                });
            } catch (error) {
                this.logger.error('Error processing context event:', error);
                res.status(500).json({
                    error: 'Failed to process context event',
                    message: error.message
                });
            }
        });

        // Bulk context event processing
        this.app.post('/api/v2/context/events/bulk', async (req, res) => {
            try {
                const { events } = req.body;
                if (!Array.isArray(events) || events.length === 0) {
                    return res.status(400).json({ error: 'Events array is required' });
                }

                const results = await this.processBulkContextEvents(events);
                res.json({
                    success: true,
                    processed: results.processed,
                    failed: results.failed,
                    totalProcessingTime: results.totalProcessingTime
                });
            } catch (error) {
                this.logger.error('Error processing bulk context events:', error);
                res.status(500).json({
                    error: 'Failed to process bulk context events',
                    message: error.message
                });
            }
        });

        // Get context statistics
        this.app.get('/api/v2/context/stats', async (req, res) => {
            try {
                const { projectId, timeframe = '24h' } = req.query;
                const stats = await this.getContextStats(projectId, timeframe);
                res.json(stats);
            } catch (error) {
                this.logger.error('Error getting context stats:', error);
                res.status(500).json({
                    error: 'Failed to get context stats',
                    message: error.message
                });
            }
        });

        // Get active projects
        this.app.get('/api/v2/context/projects', async (req, res) => {
            try {
                const projects = await this.getActiveProjects();
                res.json({ projects });
            } catch (error) {
                this.logger.error('Error getting active projects:', error);
                res.status(500).json({
                    error: 'Failed to get active projects',
                    message: error.message
                });
            }
        });
    }

    async processContextEvent(rawEvent) {
        const startTime = Date.now();
        const eventId = uuidv4();

        try {
            this.logger.info('Processing context event', { eventId, type: rawEvent.type });

            // Validate event
            await this.validateEvent(rawEvent);

            // Extract semantic information using LLM
            const analysis = await this.analyzeConversation(rawEvent.content || rawEvent.message);
            
            // Generate embedding for semantic search
            const embedding = await this.generateEmbedding(rawEvent.content || rawEvent.message);
            
            // Calculate context relevance score
            const contextScore = await this.calculateContextRelevance(rawEvent, analysis);
            
            // Create processed event
            const processedEvent = {
                id: eventId,
                project_id: rawEvent.projectId,
                session_id: rawEvent.sessionId,
                actor_id: rawEvent.actorId,
                event_type: rawEvent.type,
                event_data: rawEvent,
                content: rawEvent.content || rawEvent.message,
                semantic_vector: embedding,
                context_score: contextScore,
                importance_score: analysis.importanceScore,
                created_at: new Date().toISOString(),
                metadata: {
                    analysis: analysis,
                    processingTime: Date.now() - startTime,
                    version: '2.0.0'
                }
            };

            // Store in database
            const savedEvent = await this.storeContextEvent(processedEvent);
            
            // Publish to Kafka
            await this.publishToKafka('iris.context.events', {
                key: eventId,
                value: JSON.stringify(processedEvent),
                headers: {
                    'event-type': rawEvent.type,
                    'project-id': rawEvent.projectId,
                    'session-id': rawEvent.sessionId,
                    'actor-id': rawEvent.actorId
                }
            });

            // Extract insights asynchronously
            const insights = await this.extractInsights(processedEvent);

            this.logger.info('Context event processed successfully', { 
                eventId, 
                processingTime: Date.now() - startTime,
                contextScore,
                insightsCount: insights.length
            });

            return {
                ...savedEvent,
                processingTime: Date.now() - startTime,
                contextScore,
                insights
            };

        } catch (error) {
            this.logger.error('Error in processContextEvent:', { eventId, error: error.message });
            
            // Publish error to error topic
            await this.publishToKafka('iris.errors', {
                key: eventId,
                value: JSON.stringify({
                    eventId,
                    error: error.message,
                    rawEvent,
                    timestamp: new Date().toISOString()
                }),
                headers: {
                    'error-type': 'processing-failure',
                    'event-type': rawEvent.type
                }
            });

            throw error;
        }
    }

    async analyzeConversation(content) {
        try {
            const prompt = `
            Analyze this conversation content for context transcendence and extract key information:
            
            Content: "${content}"
            
            Please provide a JSON response with the following structure:
            {
                "intent": "primary intent of the message",
                "entities": ["key entities and concepts"],
                "sentiment": "positive|neutral|negative",
                "importanceScore": 0.0-1.0,
                "contextType": "planning|decision|question|information|creative|problem_solving",
                "keyInsights": ["important insights or takeaways"],
                "followUpRequired": true/false,
                "collaborativeElements": ["elements that suggest collaboration"],
                "futureRelevance": 0.0-1.0,
                "complexityLevel": "low|medium|high",
                "domain": "technical|business|creative|research|general"
            }
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { 
                        role: "system", 
                        content: "You are an expert in conversation analysis and context understanding. Always respond with valid JSON." 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });

            const analysisText = response.choices[0].message.content;
            const analysis = JSON.parse(analysisText);

            this.logger.debug('Conversation analysis completed', { contentLength: content.length, analysis });

            return analysis;

        } catch (error) {
            this.logger.warn('Failed to analyze conversation with LLM, using fallback analysis', error);
            
            // Fallback analysis
            return {
                intent: 'general',
                entities: [],
                sentiment: 'neutral',
                importanceScore: 0.5,
                contextType: 'information',
                keyInsights: [],
                followUpRequired: false,
                collaborativeElements: [],
                futureRelevance: 0.5,
                complexityLevel: 'medium',
                domain: 'general'
            };
        }
    }

    async generateEmbedding(content) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: content
            });

            return response.data[0].vector;
        } catch (error) {
            this.logger.warn('Failed to generate embedding', error);
            return Array(1536).fill(0); // Return zero vector as fallback
        }
    }

    async calculateContextRelevance(event, analysis) {
        try {
            // Get similar recent events for comparison
            const recentEvents = await this.getRecentSimilarEvents(event.project_id, event.content);
            
            // Calculate relevance based on multiple factors
            let relevanceScore = analysis.importanceScore * 0.4; // Base importance
            relevanceScore += analysis.futureRelevance * 0.3; // Future relevance
            relevanceScore += this.calculateRecencyScore(event.created_at) * 0.2; // Recency bonus
            relevanceScore += this.calculateDiversityScore(event, recentEvents) * 0.1; // Diversity bonus

            return Math.min(Math.max(relevanceScore, 0.0), 1.0);
        } catch (error) {
            this.logger.warn('Failed to calculate context relevance', error);
            return 0.5; // Default medium relevance
        }
    }

    calculateRecencyScore(timestamp) {
        const age = Date.now() - new Date(timestamp).getTime();
        const ageInHours = age / (1000 * 60 * 60);
        
        // Exponential decay for recency
        return Math.exp(-ageInHours / 24);
    }

    calculateDiversityScore(newEvent, recentEvents) {
        if (recentEvents.length === 0) return 0.5;
        
        // Calculate diversity based on different event types and topics
        const recentTypes = new Set(recentEvents.map(e => e.event_type));
        const newType = newEvent.type;
        
        return recentTypes.has(newType) ? 0.3 : 0.7; // Bonus for novel content types
    }

    async getRecentSimilarEvents(projectId, content, limit = 10) {
        try {
            // This would use vector similarity search
            // For now, return recent events as placeholder
            const query = `
                SELECT event_type, content 
                FROM iris_context_events 
                WHERE project_id = $1 
                AND created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC 
                LIMIT $2
            `;
            
            const result = await this.dbPool.query(query, [projectId, limit]);
            return result.rows;
        } catch (error) {
            this.logger.warn('Failed to get recent similar events', error);
            return [];
        }
    }

    async storeContextEvent(event) {
        try {
            const query = `
                INSERT INTO iris_context_events (
                    id, project_id, session_id, actor_id, event_type,
                    event_data, content, semantic_vector, context_score,
                    importance_score, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                event.id,
                event.project_id,
                event.session_id,
                event.actor_id,
                event.event_type,
                JSON.stringify(event.event_data),
                event.content,
                event.semantic_vector,
                event.context_score,
                event.importance_score,
                JSON.stringify(event.metadata)
            ];

            const result = await this.dbPool.query(query, values);
            return result.rows[0];
        } catch (error) {
            this.logger.error('Failed to store context event', error);
            throw error;
        }
    }

    async extractInsights(event) {
        try {
            const insights = [];

            // Extract collaborative patterns
            if (event.metadata.analysis.collaborativeElements.length > 0) {
                insights.push({
                    type: 'collaborative',
                    content: {
                        elements: event.metadata.analysis.collaborativeElements,
                        pattern: 'collaboration_detected',
                        strength: 0.8
                    },
                    confidence: 0.85
                });
            }

            // Extract decision patterns
            if (event.metadata.analysis.contextType === 'decision') {
                insights.push({
                    type: 'decision',
                    content: {
                        decision: event.content,
                        importance: event.importance_score,
                        context: event.metadata.analysis.domain
                    },
                    confidence: 0.9
                });
            }

            // Extract technical insights
            if (event.metadata.analysis.domain === 'technical') {
                insights.push({
                    type: 'semantic',
                    content: {
                        domain: 'technical',
                        entities: event.metadata.analysis.entities,
                        complexity: event.metadata.analysis.complexityLevel
                    },
                    confidence: 0.75
                });
            }

            // Store insights in database
            for (const insight of insights) {
                await this.storeInsight(event, insight);
            }

            this.logger.info('Insights extracted successfully', { 
                eventId: event.id, 
                insightsCount: insights.length 
            });

            return insights;
        } catch (error) {
            this.logger.warn('Failed to extract insights', error);
            return [];
        }
    }

    async storeInsight(event, insight) {
        try {
            const query = `
                INSERT INTO iris_context_insights (
                    project_id, insight_type, content, confidence_score,
                    related_event_ids, tags
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;

            const values = [
                event.project_id,
                insight.type,
                JSON.stringify(insight.content),
                insight.confidence,
                [event.id],
                [insight.type, event.metadata.analysis.domain]
            ];

            await this.dbPool.query(query, values);
        } catch (error) {
            this.logger.warn('Failed to store insight', error);
        }
    }

    async validateEvent(event) {
        if (!event.projectId) {
            throw new Error('projectId is required');
        }
        if (!event.sessionId) {
            throw new Error('sessionId is required');
        }
        if (!event.actorId) {
            throw new Error('actorId is required');
        }
        if (!event.type) {
            throw new Error('type is required');
        }
        if (!event.content && !event.message) {
            throw new Error('content or message is required');
        }
    }

    async publishToKafka(topic, message) {
        try {
            await this.producer.send({
                topic,
                messages: [message]
            });
        } catch (error) {
            this.logger.error('Failed to publish to Kafka', { topic, error: error.message });
            throw error;
        }
    }

    async getContextStats(projectId, timeframe) {
        try {
            const timeCondition = this.getTimeCondition(timeframe);
            const projectCondition = projectId ? 'AND project_id = $1' : '';
            const params = projectId ? [projectId] : [];
            
            const query = `
                SELECT 
                    COUNT(*) as total_events,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    COUNT(DISTINCT actor_id) as unique_actors,
                    AVG(context_score) as avg_context_score,
                    AVG(importance_score) as avg_importance_score,
                    COUNT(*) FILTER (WHERE event_type = 'conversational') as conversational_events,
                    COUNT(*) FILTER (WHERE event_type = 'decision') as decision_events,
                    COUNT(*) FILTER (WHERE event_type = 'action') as action_events
                FROM iris_context_events 
                WHERE created_at > NOW() - INTERVAL '${timeCondition}'
                ${projectCondition}
            `;

            const result = await this.dbPool.query(query, params);
            return result.rows[0];
        } catch (error) {
            this.logger.error('Failed to get context stats', error);
            throw error;
        }
    }

    getTimeCondition(timeframe) {
        const conditions = {
            '1h': '1 hour',
            '24h': '24 hours',
            '7d': '7 days',
            '30d': '30 days'
        };
        return conditions[timeframe] || '24 hours';
    }

    async getActiveProjects() {
        try {
            const query = `
                SELECT id, name, status, created_at, updated_at
                FROM iris_projects 
                WHERE status = 'active'
                ORDER BY updated_at DESC
            `;

            const result = await this.dbPool.query(query);
            return result.rows;
        } catch (error) {
            this.logger.error('Failed to get active projects', error);
            throw error;
        }
    }

    async processBulkContextEvents(events) {
        const results = {
            processed: 0,
            failed: 0,
            totalProcessingTime: 0
        };

        for (const event of events) {
            const startTime = Date.now();
            
            try {
                await this.processContextEvent(event);
                results.processed++;
                results.totalProcessingTime += Date.now() - startTime;
            } catch (error) {
                this.logger.error('Failed to process bulk event', error);
                results.failed++;
            }
        }

        return results;
    }

    async checkHealth() {
        try {
            // Check database
            await this.dbPool.query('SELECT 1');
            
            // Check Redis
            await this.redis.ping();
            
            // Check Kafka
            const meta = await this.producer.getMetadata();
            if (meta.brokers.length === 0) {
                throw new Error('No Kafka brokers available');
            }

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                services: {
                    database: 'healthy',
                    redis: 'healthy',
                    kafka: 'healthy'
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message,
                services: {
                    database: error.message.includes('database') ? 'unhealthy' : 'healthy',
                    redis: error.message.includes('redis') ? 'unhealthy' : 'healthy',
                    kafka: error.message.includes('kafka') ? 'unhealthy' : 'healthy'
                }
            };
        }
    }

    async startErrorConsumer() {
        const consumer = this.kafka.consumer({ groupId: 'context-capture-errors' });
        
        await consumer.connect();
        await consumer.subscribe({ topic: 'iris.errors', fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const errorData = JSON.parse(message.value.toString());
                this.logger.error('Processing error from Kafka', { errorData });
                
                // Implement error recovery logic here
                // For now, just log the error
            },
        });
    }

    startHealthCheck() {
        // Run health check every 5 minutes
        setInterval(async () => {
            const health = await this.checkHealth();
            if (health.status !== 'healthy') {
                this.logger.warn('Health check failed', health);
            }
        }, 5 * 60 * 1000);
    }

    setupErrorHandling() {
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

        process.on('SIGTERM', async () => {
            this.logger.info('SIGTERM received, shutting down gracefully');
            await this.shutdown();
        });

        process.on('SIGINT', async () => {
            this.logger.info('SIGINT received, shutting down gracefully');
            await this.shutdown();
        });
    }

    async shutdown() {
        try {
            await this.producer.disconnect();
            await this.redis.quit();
            await this.dbPool.end();
            this.logger.info('Context Capture Service shut down successfully');
            process.exit(0);
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Start the service
const service = new ContextCaptureService();
service.start().catch((error) => {
    console.error('Failed to start Context Capture Service:', error);
    process.exit(1);
});

module.exports = ContextCaptureService;