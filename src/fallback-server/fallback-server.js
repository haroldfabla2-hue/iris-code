#!/usr/bin/env node
/**
 * SERVIDOR DE FALLBACK IRIS CODE
 * Puerto 8021 - Sistema de fallback inteligente original
 * 
 * Este servicio expone las APIs del sistema de fallback original
 * de iris-code para ser consumido por el API Gateway unificado.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { IntelligentAPIRouter } = require('./intelligent_fallback_system');

class IRISFallbackServer {
    constructor() {
        this.app = express();
        this.port = process.env.FALLBACK_PORT || 8021;
        this.router = new IntelligentAPIRouter();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'IRIS Fallback Server',
                version: '2.1.0',
                timestamp: new Date().toISOString()
            });
        });

        // LLM generation endpoint
        this.app.post('/llm/generate', async (req, res) => {
            try {
                const { prompt, provider, model, ...options } = req.body;
                
                // Usar el sistema de fallback
                const result = await this.router.generateText(prompt, {
                    provider: provider || 'auto',
                    model,
                    ...options
                });
                
                res.json({
                    success: true,
                    data: result,
                    provider_used: result.provider || 'auto-selected',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Image generation endpoint
        this.app.post('/images/generate', async (req, res) => {
            try {
                const { prompt, style, category, ...options } = req.body;
                
                // Generar imagen usando el sistema de fallback
                const result = await this.generateImageWithFallback(prompt, style, category, options);
                
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Stats endpoint
        this.app.get('/stats', (req, res) => {
            res.json({
                stats: this.router.stats,
                fallbackLog: this.router.fallbackLog.slice(-10), // Últimos 10 logs
                timestamp: new Date().toISOString()
            });
        });

        // Providers status
        this.app.get('/providers', (req, res) => {
            res.json({
                llmProviders: this.router.llmProviders,
                imageProviders: this.router.imageProviders,
                status: 'active',
                timestamp: new Date().toISOString()
            });
        });
    }

    async generateImageWithFallback(prompt, style, category, options) {
        // Implementar generación de imagen con fallback
        // Esta es una versión simplificada - se puede expandir
        
        // Intentar con diferentes providers en orden de prioridad
        const providers = this.router.imageProviders;
        
        for (const [providerName, config] of Object.entries(providers)) {
            try {
                // Simular generación de imagen
                // En implementación real, aquí iría la llamada a la API del provider
                
                return {
                    id: `img_${Date.now()}_${providerName}`,
                    url: `data:image/png;base64,${Buffer.from(`Generated with ${providerName}`).toString('base64')}`,
                    prompt,
                    style,
                    category,
                    provider: providerName,
                    metadata: {
                        generated_at: new Date().toISOString(),
                        ...options
                    }
                };
            } catch (error) {
                console.log(`Provider ${providerName} failed, trying next...`);
                continue;
            }
        }
        
        throw new Error('All image providers failed');
    }

    async start() {
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`IRIS Fallback Server started on port ${this.port}`);
            console.log('Available endpoints:');
            console.log(`  - Health: http://localhost:${this.port}/health`);
            console.log(`  - LLM Generate: http://localhost:${this.port}/llm/generate`);
            console.log(`  - Image Generate: http://localhost:${this.port}/images/generate`);
            console.log(`  - Stats: http://localhost:${this.port}/stats`);
            console.log(`  - Providers: http://localhost:${this.port}/providers`);
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
            console.log('IRIS Fallback Server stopped');
        }
    }
}

// Ejecutar el servidor si se llama directamente
if (require.main === module) {
    const server = new IRISFallbackServer();
    server.start().catch(error => {
        console.error('Failed to start IRIS Fallback Server:', error);
        process.exit(1);
    });
}

module.exports = IRISFallbackServer;