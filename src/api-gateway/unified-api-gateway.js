#!/usr/bin/env node
/**
 * API GATEWAY UNIFICADO IRIS CODE + SILHOUETTE V4.0
 * 
 * Unifica todas las APIs en un solo punto de entrada:
 * 1. Sistema de Fallback Original de IRIS Code
 * 2. Framework Silhouette V4.0 (78+ teams)
 * 3. APIs de Generación de Assets
 * 4. Sistema de Monitoreo Unificado
 * 
 * Puertos:
 * - Puerto Principal: 8020 (API Gateway)
 * - Fallback: 8021 (Iris Code)
 * - Silhouette: 8022 (Orchestrator)
 * - Assets: 8023 (Asset Generation)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const winston = require('winston');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');

class UnifiedAPIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.GATEWAY_PORT || 8020;
        this.services = {
            fallback: process.env.FALLBACK_PORT || 8021,
            silhouette: process.env.SILHOUETTE_PORT || 8022,
            assets: process.env.ASSETS_PORT || 8023,
            mcp: process.env.MCP_PORT || 8027,
            context_bridge: process.env.CONTEXT_BRIDGE_PORT || 8104,
            context_capture: process.env.CONTEXT_CAPTURE_PORT || 8100,
            context_retrieval: process.env.CONTEXT_RETRIEVAL_PORT || 8102
        };
        this.running = false;
        this.stats = {
            requests: 0,
            responses: 0,
            errors: 0,
            services: {}
        };
        
        this.setupLogging();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupHealthChecks();
        this.setupUnifiedAPI();
    }

    setupLogging() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/api-gateway.log' }),
                new winston.transports.Console()
            ]
        });
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true
        }));
        this.app.use(morgan('combined'));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // limit each IP to 1000 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use(limiter);

        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-API-Version', '4.0.0');
            res.setHeader('X-Unified-Gateway', 'IRIS+Silhouette');
            next();
        });
    }

    setupRoutes() {
        // Health check del gateway
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                gateway: 'Unified API Gateway',
                version: '4.0.0',
                timestamp: new Date().toISOString(),
                services: this.services,
                uptime: process.uptime()
            });
        });

        // Status general del sistema
        this.app.get('/status', async (req, res) => {
            const status = await this.getSystemStatus();
            res.json(status);
        });

        // Proxies a servicios individuales
        this.setupProxyRoutes();

        // APIs unificadas (se configuran en setupUnifiedAPI)
    }

    setupProxyRoutes() {
        // Proxy al sistema de fallback original (IRIS Code)
        this.app.use('/api/fallback', createProxyMiddleware({
            target: `http://localhost:${this.services.fallback}`,
            changeOrigin: true,
            pathRewrite: {
                '^/api/fallback': '',
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.info('Proxying fallback request', { 
                    method: req.method, 
                    path: req.path 
                });
            }
        }));

        // Proxy al orquestador Silhouette
        this.app.use('/api/silhouette', createProxyMiddleware({
            target: `http://localhost:${this.services.silhouette}`,
            changeOrigin: true,
            pathRewrite: {
                '^/api/silhouette': '',
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.info('Proxying silhouette request', { 
                    method: req.method, 
                    path: req.path 
                });
            }
        }));

        // Proxy al generador de assets
        this.app.use('/api/assets', createProxyMiddleware({
            target: `http://localhost:${this.services.assets}`,
            changeOrigin: true,
            pathRewrite: {
                '^/api/assets': '',
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.info('Proxying assets request', { 
                    method: req.method, 
                    path: req.path 
                });
            }
        }));

        // Proxy al servidor MCP
        this.app.use('/api/mcp', createProxyMiddleware({
            target: `http://localhost:${this.services.mcp}`,
            changeOrigin: true,
            pathRewrite: {
                '^/api/mcp': '',
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.info('Proxying MCP request', { 
                    method: req.method, 
                    path: req.path 
                });
            }
        }));

        // Proxy al Context Bridge Service (Sistema de Memoria Trans-Sesional)
        this.app.use('/api/context', createProxyMiddleware({
            target: `http://localhost:${this.services.context_bridge || 8104}`,
            changeOrigin: true,
            pathRewrite: {
                '^/api/context': '',
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.info('Proxying context request', { 
                    method: req.method, 
                    path: req.path 
                });
            }
        }));
    }

    setupUnifiedAPI() {
        // Endpoint unificado para LLMs con fallback inteligente
        this.app.post('/api/llm/generate', async (req, res) => {
            try {
                this.stats.requests++;
                const { prompt, provider, model, ...options } = req.body;
                
                // Usar el sistema de fallback de IRIS Code
                const response = await axios.post(`http://localhost:${this.services.fallback}/llm/generate`, {
                    prompt, provider, model, ...options
                });
                
                this.stats.responses++;
                res.json(response.data);
            } catch (error) {
                this.stats.errors++;
                this.logger.error('LLM generation error', error);
                res.status(500).json({ error: 'LLM generation failed' });
            }
        });

        // Endpoint unificado para generación de imágenes
        this.app.post('/api/images/generate', async (req, res) => {
            try {
                this.stats.requests++;
                const { prompt, style, category, ...options } = req.body;
                
                // Generar imagen usando APIs configuradas
                const imageData = await this.generateImage(prompt, style, category, options);
                
                this.stats.responses++;
                res.json(imageData);
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Image generation error', error);
                res.status(500).json({ error: 'Image generation failed' });
            }
        });

        // Endpoint para ejecutar workflows con equipos especializados
        this.app.post('/api/workflows/execute', async (req, res) => {
            try {
                this.stats.requests++;
                const { workflow, parameters, priority } = req.body;
                
                // Ejecutar workflow a través del orquestador Silhouette
                const result = await axios.post(`http://localhost:${this.services.silhouette}/workflows/execute`, {
                    workflow, parameters, priority
                });
                
                this.stats.responses++;
                res.json(result.data);
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Workflow execution error', error);
                res.status(500).json({ error: 'Workflow execution failed' });
            }
        });

        // Endpoint para obtener lista de equipos disponibles
        this.app.get('/api/teams', async (req, res) => {
            try {
                const teams = await axios.get(`http://localhost:${this.services.silhouette}/teams`);
                res.json(teams.data);
            } catch (error) {
                this.logger.error('Failed to fetch teams', error);
                res.status(500).json({ error: 'Failed to fetch teams' });
            }
        });

        // Endpoint para ejecutar tareas con equipos específicos
        this.app.post('/api/teams/:teamId/execute', async (req, res) => {
            try {
                this.stats.requests++;
                const { teamId } = req.params;
                const { task, parameters } = req.body;
                
                const result = await axios.post(
                    `http://localhost:${this.services.silhouette}/teams/${teamId}/execute`,
                    { task, parameters }
                );
                
                this.stats.responses++;
                res.json(result.data);
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Team execution error', error);
                res.status(500).json({ error: 'Team execution failed' });
            }
        });

        // Endpoint para métricas unificadas
        this.app.get('/api/metrics/unified', async (req, res) => {
            try {
                const metrics = await this.getUnifiedMetrics();
                res.json(metrics);
            } catch (error) {
                this.logger.error('Failed to fetch unified metrics', error);
                res.status(500).json({ error: 'Failed to fetch metrics' });
            }
        });

        // Endpoint para chat unificado (backend MCP + Frontend)
        this.app.post('/api/chat', async (req, res) => {
            try {
                this.stats.requests++;
                const { message, context, stream } = req.body;
                
                // Usar el sistema MCP para chat inteligente
                const chatResponse = await axios.post(`http://localhost:${this.services.mcp}/chat`, {
                    message, context, stream
                });
                
                this.stats.responses++;
                res.json(chatResponse.data);
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Chat error', error);
                res.status(500).json({ error: 'Chat failed' });
            }
        });

        // Endpoints específicos para assets
        this.app.post('/api/assets/branding', async (req, res) => {
            try {
                const { requirements } = req.body;
                const brandingAssets = await this.generateBrandingAssets(requirements);
                res.json(brandingAssets);
            } catch (error) {
                res.status(500).json({ error: 'Branding assets generation failed' });
            }
        });

        this.app.post('/api/assets/marketing', async (req, res) => {
            try {
                const { requirements } = req.body;
                const marketingAssets = await this.generateMarketingAssets(requirements);
                res.json(marketingAssets);
            } catch (error) {
                res.status(500).json({ error: 'Marketing assets generation failed' });
            }
        });

        this.app.post('/api/assets/mobile', async (req, res) => {
            try {
                const { requirements } = req.body;
                const mobileAssets = await this.generateMobileAssets(requirements);
                res.json(mobileAssets);
            } catch (error) {
                res.status(500).json({ error: 'Mobile assets generation failed' });
            }
        });
    }

    async generateImage(prompt, style, category, options) {
        // Implementar generación de imagen usando las APIs configuradas
        // Esta es una versión simplificada - se puede expandir con lógica más compleja
        
        return {
            id: `img_${Date.now()}`,
            url: `data:image/png;base64,${Buffer.from('Generated image placeholder').toString('base64')}`,
            prompt,
            style,
            category,
            metadata: {
                provider: 'freepik',
                generated_at: new Date().toISOString(),
                ...options
            }
        };
    }

    async generateBrandingAssets(requirements) {
        // Generar assets de branding
        return {
            category: 'branding',
            assets: [
                {
                    type: 'logo',
                    url: '/assets/logo-primary.png',
                    variations: ['primary', 'secondary', 'monochrome']
                },
                {
                    type: 'color_palette',
                    colors: ['#007bff', '#6c757d', '#28a745', '#ffc107', '#dc3545']
                },
                {
                    type: 'typography',
                    fonts: ['primary-font', 'secondary-font', 'mono-font']
                }
            ]
        };
    }

    async generateMarketingAssets(requirements) {
        // Generar assets de marketing
        return {
            category: 'marketing',
            assets: [
                {
                    type: 'banners',
                    sizes: ['728x90', '300x250', '320x50']
                },
                {
                    type: 'social_media',
                    formats: ['instagram_post', 'facebook_post', 'twitter_card', 'linkedin_banner']
                },
                {
                    type: 'presentations',
                    templates: ['corporate', 'product_demo', 'sales_pitch']
                }
            ]
        };
    }

    async generateMobileAssets(requirements) {
        // Generar assets móviles
        return {
            category: 'mobile',
            assets: [
                {
                    type: 'app_icons',
                    sizes: ['16x16', '32x32', '64x64', '128x128', '256x256', '512x512']
                },
                {
                    type: 'splash_screens',
                    devices: ['iPhone', 'Android', 'iPad']
                },
                {
                    type: 'ui_elements',
                    components: ['buttons', 'forms', 'cards', 'navigation']
                }
            ]
        };
    }

    async getSystemStatus() {
        const services = {};
        
        for (const [name, port] of Object.entries(this.services)) {
            try {
                const response = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
                services[name] = {
                    status: 'healthy',
                    port,
                    response_time: response.data?.uptime || 0
                };
            } catch (error) {
                services[name] = {
                    status: 'unhealthy',
                    port,
                    error: error.message
                };
            }
        }

        return {
            gateway_status: this.running ? 'running' : 'stopped',
            services,
            stats: this.stats,
            timestamp: new Date().toISOString()
        };
    }

    async getUnifiedMetrics() {
        return {
            gateway: {
                requests: this.stats.requests,
                responses: this.stats.responses,
                errors: this.stats.errors,
                uptime: process.uptime()
            },
            services: await this.getSystemStatus(),
            backend_metrics: {
                iris_fallback: {
                    providers_available: 5,
                    last_fallback: null,
                    success_rate: 0.99
                },
                silhouette_teams: {
                    total_teams: 78,
                    active_teams: 0,
                    workflows_completed: 0
                },
                assets_generation: {
                    images_generated: 0,
                    videos_generated: 0,
                    documents_generated: 0
                }
            }
        };
    }

    setupHealthChecks() {
        // Health check periódico de todos los servicios
        setInterval(async () => {
            const status = await this.getSystemStatus();
            this.logger.info('System health check', status);
        }, 30000); // cada 30 segundos
    }

    async start() {
        if (this.running) {
            this.logger.warn('Gateway already running');
            return;
        }

        this.server = this.app.listen(this.port, () => {
            this.running = true;
            this.logger.info(`Unified API Gateway started on port ${this.port}`);
            this.logger.info('Available endpoints:');
            this.logger.info(`  - Health: http://localhost:${this.port}/health`);
            this.logger.info(`  - Status: http://localhost:${this.port}/status`);
            this.logger.info(`  - Fallback API: http://localhost:${this.port}/api/fallback/*`);
            this.logger.info(`  - Silhouette API: http://localhost:${this.port}/api/silhouette/*`);
            this.logger.info(`  - Assets API: http://localhost:${this.port}/api/assets/*`);
            this.logger.info(`  - Unified LLM: http://localhost:${this.port}/api/llm/generate`);
            this.logger.info(`  - Unified Chat: http://localhost:${this.port}/api/chat`);
            this.logger.info(`  - Unified Metrics: http://localhost:${this.port}/api/metrics/unified`);
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.running = false;
            this.logger.info('Unified API Gateway stopped');
        }
    }
}

// Ejecutar el gateway si se llama directamente
if (require.main === module) {
    const gateway = new UnifiedAPIGateway();
    gateway.start().catch(error => {
        console.error('Failed to start gateway:', error);
        process.exit(1);
    });
}

module.exports = UnifiedAPIGateway;