#!/usr/bin/env node

/**
 * SCRIPT DE VERIFICACIÓN DE INTEGRACIÓN COMPLETA
 * Verifica que frontend y backend estén completamente conectados
 * y que todas las APIs funcionen correctamente
 */

const axios = require('axios');
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class IntegrationVerifier {
    constructor() {
        this.services = {
            apiGateway: 'http://localhost:8020',
            fallbackServer: 'http://localhost:8021',
            silhouetteOrchestrator: 'http://localhost:8022',
            assetsServer: 'http://localhost:8023',
            mcpServer: 'http://localhost:8027',
            irisBackend: 'http://localhost:3000',
            irisFrontend: 'http://localhost:3001'
        };
        
        this.results = {
            services: {},
            apis: {},
            integration: {}
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async checkServiceHealth(name, url) {
        try {
            const response = await axios.get(`${url}/health`, { timeout: 5000 });
            this.results.services[name] = {
                status: 'healthy',
                responseTime: response.data.uptime || 0,
                message: 'OK'
            };
            this.log(`✅ ${name}: HEALTHY`, 'green');
            return true;
        } catch (error) {
            this.results.services[name] = {
                status: 'unhealthy',
                error: error.message,
                message: 'FAILED'
            };
            this.log(`❌ ${name}: FAILED - ${error.message}`, 'red');
            return false;
        }
    }

    async checkAPIEndpoint(name, url, method = 'GET', data = null) {
        try {
            const config = {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Version': '4.0.0'
                }
            };

            let response;
            if (method === 'POST') {
                response = await axios.post(url, data, config);
            } else {
                response = await axios.get(url, config);
            }

            this.results.apis[name] = {
                status: 'success',
                responseTime: response.headers['response-time'] || 0,
                data: response.data
            };
            this.log(`✅ API ${name}: SUCCESS`, 'green');
            return true;
        } catch (error) {
            this.results.apis[name] = {
                status: 'error',
                error: error.message
            };
            this.log(`❌ API ${name}: FAILED - ${error.message}`, 'red');
            return false;
        }
    }

    async testUnifiedAPI() {
        this.log('\n🧪 Probando API Unificada del Gateway...', 'blue');
        
        // Test 1: Health check
        await this.checkAPIEndpoint('Health Check', `${this.services.apiGateway}/health`);
        
        // Test 2: Status
        await this.checkAPIEndpoint('System Status', `${this.services.apiGateway}/status`);
        
        // Test 3: Métricas unificadas
        await this.checkAPIEndpoint('Unified Metrics', `${this.services.apiGateway}/api/metrics/unified`);
        
        // Test 4: Equipos disponibles
        await this.checkAPIEndpoint('Available Teams', `${this.services.apiGateway}/api/teams`);
        
        // Test 5: LLM con fallback
        await this.checkAPIEndpoint('LLM Generation', 
            `${this.services.apiGateway}/api/llm/generate`, 
            'POST', 
            { prompt: 'Test de generación de texto' }
        );
        
        // Test 6: Chat
        await this.checkAPIEndpoint('Chat API', 
            `${this.services.apiGateway}/api/chat`, 
            'POST', 
            { message: 'Test de chat', context: {} }
        );
    }

    testFrontendConnectivity() {
        this.log('\n🌐 Verificando conectividad del Frontend...', 'blue');
        
        // Test frontend accessibility
        return axios.get(this.services.irisFrontend, { timeout: 5000 })
            .then(response => {
                this.results.integration.frontend = {
                    status: 'accessible',
                    statusCode: response.status,
                    contentLength: response.data.length
                };
                this.log('✅ Frontend: ACCESIBLE', 'green');
                return true;
            })
            .catch(error => {
                this.results.integration.frontend = {
                    status: 'inaccessible',
                    error: error.message
                };
                this.log(`❌ Frontend: INACCESIBLE - ${error.message}`, 'red');
                return false;
            });
    }

    async testBackendIntegration() {
        this.log('\n🔧 Verificando integración del Backend...', 'blue');
        
        // Test fallback server
        await this.checkAPIEndpoint('Fallback Health', `${this.services.fallbackServer}/health`);
        await this.checkAPIEndpoint('Fallback Stats', `${this.services.fallbackServer}/stats`);
        await this.checkAPIEndpoint('Fallback Providers', `${this.services.fallbackServer}/providers`);
        
        // Test Silhouette orchestrator
        await this.checkAPIEndpoint('Silhouette Health', `${this.services.silhouetteOrchestrator}/health`);
        await this.checkAPIEndpoint('Silhouette Teams', `${this.services.silhouetteOrchestrator}/teams`);
        await this.checkAPIEndpoint('Silhouette Stats', `${this.services.silhouetteOrchestrator}/stats`);
    }

    generateReport() {
        this.log('\n📊 REPORTE DE VERIFICACIÓN DE INTEGRACIÓN', 'bold');
        this.log('=' * 60, 'blue');
        
        // Services status
        this.log('\n🏥 ESTADO DE SERVICIOS:', 'blue');
        const servicesCount = Object.keys(this.results.services).length;
        const healthyServices = Object.values(this.results.services).filter(s => s.status === 'healthy').length;
        this.log(`Servicios saludables: ${healthyServices}/${servicesCount}`);
        
        // APIs status
        this.log('\n🔌 ESTADO DE APIs:', 'blue');
        const apisCount = Object.keys(this.results.apis).length;
        const successfulAPIs = Object.values(this.results.apis).filter(a => a.status === 'success').length;
        this.log(`APIs exitosas: ${successfulAPIs}/${apisCount}`);
        
        // Integration status
        this.log('\n🔗 ESTADO DE INTEGRACIÓN:', 'blue');
        this.log(`Frontend: ${this.results.integration.frontend?.status || 'Unknown'}`);
        
        // Overall status
        this.log('\n🎯 ESTADO GENERAL:', 'bold');
        const totalHealth = healthyServices + successfulAPIs;
        const totalChecks = servicesCount + apisCount;
        const healthPercentage = Math.round((totalHealth / totalChecks) * 100);
        
        if (healthPercentage >= 80) {
            this.log(`🟢 INTEGRACIÓN EXITOSA: ${healthPercentage}%`, 'green');
        } else if (healthPercentage >= 60) {
            this.log(`🟡 INTEGRACIÓN PARCIAL: ${healthPercentage}%`, 'yellow');
        } else {
            this.log(`🔴 INTEGRACIÓN FALLIDA: ${healthPercentage}%`, 'red');
        }
        
        // Recommendations
        this.log('\n💡 RECOMENDACIONES:', 'blue');
        
        const failedServices = Object.entries(this.results.services)
            .filter(([_, service]) => service.status !== 'healthy')
            .map(([name, _]) => name);
            
        if (failedServices.length > 0) {
            this.log(`Servicios caídos: ${failedServices.join(', ')}`, 'yellow');
            this.log('→ Verificar logs con: docker-compose logs [service-name]', 'yellow');
        }
        
        const failedAPIs = Object.entries(this.results.apis)
            .filter(([_, api]) => api.status !== 'success')
            .map(([name, _]) => name);
            
        if (failedAPIs.length > 0) {
            this.log(`APIs fallidas: ${failedAPIs.join(', ')}`, 'yellow');
            this.log('→ Verificar configuración de APIs y variables de entorno', 'yellow');
        }
        
        if (healthPercentage >= 80) {
            this.log('🎉 Sistema listo para uso en producción!', 'green');
        } else {
            this.log('⚠️  Revisar problemas antes de usar en producción', 'yellow');
        }
        
        return healthPercentage;
    }

    async runFullVerification() {
        this.log('🚀 Iniciando verificación completa de integración...', 'bold');
        
        // Check all services
        this.log('\n🔍 Verificando servicios...', 'blue');
        for (const [name, url] of Object.entries(this.services)) {
            await this.checkServiceHealth(name, url);
        }
        
        // Test unified API
        await this.testUnifiedAPI();
        
        // Test backend integration
        await this.testBackendIntegration();
        
        // Test frontend connectivity
        await this.testFrontendConnectivity();
        
        // Generate final report
        const healthPercentage = this.generateReport();
        
        // Save results
        require('fs').writeFileSync(
            'integration-verification-report.json',
            JSON.stringify(this.results, null, 2)
        );
        
        this.log('\n📄 Reporte guardado en: integration-verification-report.json', 'blue');
        
        return healthPercentage;
    }
}

// Ejecutar verificación
if (require.main === module) {
    const verifier = new IntegrationVerifier();
    
    verifier.runFullVerification()
        .then(healthPercentage => {
            process.exit(healthPercentage >= 80 ? 0 : 1);
        })
        .catch(error => {
            console.error('Error during verification:', error);
            process.exit(1);
        });
}

module.exports = IntegrationVerifier;