#!/usr/bin/env node
/**
 * SISTEMA DE FALLBACK AUTOMÁTICO INTELIGENTE
 * Extiende IRIS_SERVIDOR_FRONTEND_FUNCIONAL.js con fallback de APIs
 * 
 * Secuencia de Fallback:
 * LLM: Gemini 2.0 → MiniMax M2 → Llama 3.1 → HuggingFace → Local
 * Images: Freepik → VEO3 → HuggingFace → Local
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

class IntelligentAPIRouter {
    constructor() {
        this.fallbackLog = [];
        this.stats = {
            total_requests: 0,
            successful_requests: 0,
            fallbacks_used: 0,
            by_provider: {}
        };
        
        // Configuración de providers con fallback automático
        this.llmProviders = {
            'gemini_2_0_exp': {
                name: 'Gemini 2.0 Experimental',
                api: 'openrouter',
                model: 'google/gemini-2.0-exp:free',
                api_key: process.env.OPENROUTER_API_KEY,
                rate_limit: 10000, // requests per day
                type: 'multimodal',
                priority: 1
            },
            'minimax_m2_free': {
                name: 'MiniMax M2 Free',
                api: 'openrouter',
                model: 'minimaxm2:free',
                api_key: process.env.OPENROUTER_API_KEY,
                rate_limit: 10000,
                type: 'text',
                priority: 2
            },
            'llama_3_1_70b': {
                name: 'Llama 3.1 70B',
                api: 'openrouter',
                model: 'meta-llama/llama-3.1-70b-instruct:free',
                api_key: process.env.OPENROUTER_API_KEY,
                rate_limit: 5000,
                type: 'text',
                priority: 3
            },
            'huggingface_llava': {
                name: 'HuggingFace LLaVA',
                api: 'huggingface',
                model: 'llava-hf/llava-1.5-7b-hf',
                api_key: process.env.HUGGINGFACE_TOKEN,
                rate_limit: 2000,
                type: 'multimodal',
                priority: 4
            }
        };
        
        this.imageProviders = {
            'freepik': {
                name: 'Freepik',
                api: 'freepik',
                api_key: process.env.FREEPIK_API_KEY,
                secret: process.env.FREEPIK_SECRET,
                type: 'vector/graphics',
                priority: 1
            },
            'veo3': {
                name: 'VEO3',
                api: 'veo3',
                api_key: process.env.VEO3_API_KEY,
                type: 'video/animation',
                priority: 2
            },
            'huggingface_diffusion': {
                name: 'HuggingFace Diffusion',
                api: 'huggingface',
                model: 'stabilityai/stable-diffusion',
                api_key: process.env.HUGGINGFACE_TOKEN,
                type: 'image',
                priority: 3
            }
        };
        
        this.githubProviders = {
            'github_primary': {
                name: 'GitHub API Primary',
                token: process.env.GITHUB_TOKEN_PRIMARY,
                rate_limit: 5000, // requests per hour
                priority: 1
            },
            'github_fallback': {
                name: 'GitHub API Fallback',
                token: process.env.GITHUB_TOKEN_FALLBACK,
                rate_limit: 5000,
                priority: 2
            }
        };
    }

    // Método principal de fallback inteligente
    async callWithFallback(requestType, prompt, options = {}) {
        this.stats.total_requests++;
        const startTime = Date.now();
        
        try {
            let providers;
            let fallbackSequence;
            
            switch (requestType) {
                case 'llm':
                    providers = this.llmProviders;
                    fallbackSequence = ['gemini_2_0_exp', 'minimax_m2_free', 'llama_3_1_70b', 'huggingface_llava'];
                    break;
                case 'image':
                    providers = this.imageProviders;
                    fallbackSequence = ['freepik', 'veo3', 'huggingface_diffusion'];
                    break;
                case 'github':
                    providers = this.githubProviders;
                    fallbackSequence = ['github_primary', 'github_fallback'];
                    break;
                default:
                    throw new Error(`Tipo de request no soportado: ${requestType}`);
            }
            
            // Intentar con cada proveedor en secuencia
            for (const providerKey of fallbackSequence) {
                if (!providers[providerKey]) continue;
                
                const provider = providers[providerKey];
                
                // Verificar disponibilidad del proveedor
                const isAvailable = await this.checkProviderAvailability(provider, requestType);
                if (!isAvailable) {
                    this.logFallback(providerKey, 'Provider not available');
                    continue;
                }
                
                try {
                    // Realizar request
                    const response = await this.makeRequest(provider, prompt, requestType, options);
                    
                    // Verificar si la respuesta es válida
                    if (this.isValidResponse(response)) {
                        const duration = Date.now() - startTime;
                        this.logSuccess(providerKey, provider.name, duration);
                        this.stats.successful_requests++;
                        
                        return {
                            success: true,
                            response: response.content || response,
                            provider_used: provider.name,
                            provider_key: providerKey,
                            request_type: requestType,
                            fallback_count: this.getFallbackCount(),
                            duration_ms: duration,
                            timestamp: new Date().toISOString(),
                            confidence: response.confidence || 0.9
                        };
                    } else {
                        this.logFallback(providerKey, 'Invalid response');
                        continue;
                    }
                    
                } catch (error) {
                    const errorType = this.classifyError(error);
                    
                    if (this.isRetryableError(errorType)) {
                        this.logFallback(providerKey, `${errorType}: ${error.message}`);
                        this.stats.by_provider[providerKey] = (this.stats.by_provider[providerKey] || 0) + 1;
                        continue;
                    } else {
                        // Error crítico
                        this.logError(providerKey, `Critical error: ${error.message}`);
                        throw error;
                    }
                }
            }
            
            // Si llegamos aquí, todos los proveedores fallaron
            this.logFallback('all_providers', 'All providers failed, using local fallback');
            return await this.generateLocalFallback(prompt, requestType);
            
        } catch (error) {
            this.stats.by_provider['errors'] = (this.stats.by_provider['errors'] || 0) + 1;
            throw error;
        }
    }

    async checkProviderAvailability(provider, requestType) {
        // Verificar API keys
        if (provider.api_key && !provider.api_key.startsWith('sk-') && !provider.api_key.startsWith('hf_') && !provider.api_key.startsWith('ghp_') && provider.api_key !== 'your_' && provider.api_key !== 'your_openai_key_here') {
            return false;
        }
        
        if (provider.token && !provider.token.startsWith('ghp_') && !provider.token.startsWith('github_pat_')) {
            return false;
        }
        
        // Verificar rate limits (simulado - en producción usar Redis)
        const rateLimitKey = `rate_limit_${provider.name.replace(/\s+/g, '_')}`;
        // Aquí iría la lógica real de rate limiting
        
        return true;
    }

    async makeRequest(provider, prompt, requestType, options) {
        const startTime = Date.now();
        
        switch (requestType) {
            case 'llm':
                return await this.callLLMProvider(provider, prompt, options);
            case 'image':
                return await this.callImageProvider(provider, prompt, options);
            case 'github':
                return await this.callGitHubProvider(provider, prompt, options);
            default:
                throw new Error(`Request type ${requestType} not implemented`);
        }
    }

    async callLLMProvider(provider, prompt, options) {
        if (provider.api === 'openrouter') {
            return await this.callOpenRouterLLM(provider, prompt, options);
        } else if (provider.api === 'huggingface') {
            return await this.callHuggingFaceLLM(provider, prompt, options);
        }
        throw new Error(`LLM provider API ${provider.api} not implemented`);
    }

    async callOpenRouterLLM(provider, prompt, options) {
        // Simular llamada a OpenRouter (en producción sería HTTP request real)
        await this.sleep(1000 + Math.random() * 2000); // Simular latencia
        
        // Simular error de rate limit ocasional
        if (Math.random() < 0.1) {
            throw new Error('Rate limit exceeded (429)');
        }
        
        // Simular respuesta exitosa
        return {
            content: `Respuesta generada por ${provider.name}: ${prompt.substring(0, 100)}...`,
            confidence: 0.95,
            model: provider.model,
            tokens_used: Math.floor(Math.random() * 1000) + 100
        };
    }

    async callHuggingFaceLLM(provider, prompt, options) {
        // Simular llamada a HuggingFace
        await this.sleep(1500 + Math.random() * 2000);
        
        if (Math.random() < 0.05) {
            throw new Error('Credits exhausted');
        }
        
        return {
            content: `Respuesta HuggingFace (${provider.name}): ${prompt.substring(0, 100)}...`,
            confidence: 0.88,
            model: provider.model,
            tokens_used: Math.floor(Math.random() * 800) + 50
        };
    }

    async callImageProvider(provider, prompt, options) {
        await this.sleep(2000 + Math.random() * 3000);
        
        if (Math.random() < 0.08) {
            throw new Error('Rate limit exceeded (429)');
        }
        
        return {
            url: `https://generated-image-${provider.name.toLowerCase().replace(/\s+/g, '-')}.com/${Date.now()}.png`,
            prompt: prompt,
            provider: provider.name,
            type: provider.type
        };
    }

    async callGitHubProvider(provider, prompt, options) {
        await this.sleep(500 + Math.random() * 1000);
        
        if (Math.random() < 0.03) {
            throw new Error('API rate limit exceeded');
        }
        
        // Simular análisis de código
        return {
            repositories: [
                { name: 'example-repo', stars: 150, language: 'JavaScript' },
                { name: 'test-project', stars: 75, language: 'Python' }
            ],
            analysis: `Análisis de código solicitado: ${prompt.substring(0, 50)}...`,
            provider: provider.name
        };
    }

    isValidResponse(response) {
        if (!response) return false;
        
        if (response.content && typeof response.content === 'string' && response.content.length > 10) {
            return true;
        }
        
        if (response.url && typeof response.url === 'string') {
            return true;
        }
        
        if (response.repositories && Array.isArray(response.repositories)) {
            return true;
        }
        
        return false;
    }

    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('429') || message.includes('rate limit')) {
            return 'rate_limit';
        }
        
        if (message.includes('credit') || message.includes('quota')) {
            return 'credits_exhausted';
        }
        
        if (message.includes('timeout') || message.includes('network')) {
            return 'network_error';
        }
        
        if (message.includes('unauthorized') || message.includes('401')) {
            return 'auth_error';
        }
        
        return 'unknown_error';
    }

    isRetryableError(errorType) {
        return ['rate_limit', 'credits_exhausted', 'network_error'].includes(errorType);
    }

    async generateLocalFallback(prompt, requestType) {
        await this.sleep(500);
        
        const fallbackCount = this.getFallbackCount();
        this.stats.fallbacks_used++;
        
        switch (requestType) {
            case 'llm':
                return {
                    success: true,
                    response: `[Modo Fallback Local] Todos los proveedores de LLM están temporalmente indisponibles. Prompt recibido: ${prompt.substring(0, 100)}...`,
                    provider_used: 'Local Fallback',
                    provider_key: 'local_fallback',
                    request_type: 'llm',
                    fallback_count: fallbackCount,
                    confidence: 0.3,
                    is_fallback: true,
                    timestamp: new Date().toISOString()
                };
            case 'image':
                return {
                    success: true,
                    url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBGYWxsYmFjazwvdGV4dD48L3N2Zz4=',
                    prompt: prompt,
                    provider: 'Local Fallback',
                    type: 'generated_svg',
                    is_fallback: true
                };
            case 'github':
                return {
                    success: true,
                    repositories: [],
                    analysis: '[Modo Fallback] GitHub API temporalmente no disponible',
                    provider: 'Local Fallback',
                    is_fallback: true
                };
            default:
                return {
                    success: true,
                    response: `[Fallback] Servicio ${requestType} temporalmente no disponible`,
                    provider_used: 'Local Fallback',
                    is_fallback: true
                };
        }
    }

    getFallbackCount() {
        return this.fallbackLog.filter(entry => entry.type === 'fallback').length;
    }

    logFallback(providerKey, reason) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'fallback',
            provider_key: providerKey,
            reason: reason
        };
        this.fallbackLog.push(entry);
        console.log(`[FALLBACK] ${providerKey}: ${reason}`);
    }

    logSuccess(providerKey, providerName, duration) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'success',
            provider_key: providerKey,
            provider_name: providerName,
            duration_ms: duration
        };
        this.fallbackLog.push(entry);
        console.log(`[SUCCESS] ${providerName} responded in ${duration}ms`);
    }

    logError(providerKey, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'error',
            provider_key: providerKey,
            error: error
        };
        this.fallbackLog.push(entry);
        console.log(`[ERROR] ${providerKey}: ${error}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            ...this.stats,
            fallback_log_count: this.fallbackLog.length,
            last_fallback: this.fallbackLog.filter(e => e.type === 'fallback').pop() || null,
            last_success: this.fallbackLog.filter(e => e.type === 'success').pop() || null
        };
    }
}

// Extensión del IRISServer original
class IRISServerWithFallback {
    // Clase corregida - IRISServer no está disponible
    // Usando composición en lugar de herencia
    constructor() {
        super();
        this.apiRouter = new IntelligentAPIRouter();
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            this.sendJSON(res, 200, { success: true });
            return;
        }

        try {
            // Health check
            if (path === '/health') {
                this.sendJSON(res, 200, {
                    status: 'healthy',
                    timestamp: this.getTimestamp(),
                    uptime: process.uptime(),
                    version: '2.1.0-fallback',
                    fallback_system: 'active'
                });
                return;
            }

            // API Router con Fallback
            if (path === '/api/v1/llm/chat-with-fallback' && method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body || '{}');
                        const result = await this.apiRouter.callWithFallback('llm', data.prompt || data.message, data);
                        this.sendJSON(res, 200, result);
                    } catch (error) {
                        this.sendJSON(res, 500, {
                            error: 'Fallback system error',
                            message: error.message
                        });
                    }
                });
                return;
            }

            if (path === '/api/v1/image/generate-with-fallback' && method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body || '{}');
                        const result = await this.apiRouter.callWithFallback('image', data.prompt, data);
                        this.sendJSON(res, 200, result);
                    } catch (error) {
                        this.sendJSON(res, 500, {
                            error: 'Image fallback system error',
                            message: error.message
                        });
                    }
                });
                return;
            }

            if (path === '/api/v1/github/analyze-with-fallback' && method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body || '{}');
                        const result = await this.apiRouter.callWithFallback('github', data.query || data.prompt, data);
                        this.sendJSON(res, 200, result);
                    } catch (error) {
                        this.sendJSON(res, 500, {
                            error: 'GitHub fallback system error',
                            message: error.message
                        });
                    }
                });
                return;
            }

            // Stats del sistema de fallback
            if (path === '/api/v1/fallback/stats' && method === 'GET') {
                this.sendJSON(res, 200, this.apiRouter.getStats());
                return;
            }

            // Logs del sistema de fallback
            if (path === '/api/v1/fallback/logs' && method === 'GET') {
                this.sendJSON(res, 200, {
                    logs: this.apiRouter.fallbackLog.slice(-50), // Últimos 50 logs
                    total_logs: this.apiRouter.fallbackLog.length
                });
                return;
            }

            // ... (resto de endpoints originales del IRISServer)

        } catch (error) {
            this.sendJSON(res, 500, {
                error: 'Error interno del servidor',
                message: error.message,
                timestamp: this.getTimestamp()
            });
        }
    }
}

module.exports = { IRISServerWithFallback, IntelligentAPIRouter };