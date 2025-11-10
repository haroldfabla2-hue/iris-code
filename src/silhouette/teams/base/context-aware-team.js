#!/usr/bin/env node
/**
 * CONTEXT AWARE TEAM BASE CLASS
 * 
 * Clase base para equipos que incluyen capacidades de Context Memory
 * Proporciona:
 * - Captura automática de contexto
 * - Recuperación de contexto histórico
 * - Búsqueda semántica integrada
 * - Optimización basada en patrones
 */

const axios = require('axios');
const EventEmitter = require('events');

class ContextAwareTeam extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.teamId = config.teamId;
        this.teamName = config.teamName;
        this.teamType = config.teamType;
        this.contextBridgeUrl = process.env.CONTEXT_BRIDGE_URL || 'http://context-bridge:8104';
        this.isProcessing = false;
        
        // Estadísticas del equipo
        this.stats = {
            tasks_processed: 0,
            context_captures: 0,
            context_retrievals: 0,
            successful_tasks: 0,
            failed_tasks: 0,
            average_response_time: 0
        };
        
        this.logger = {
            info: (msg, data) => console.log(`[${this.teamName}] INFO: ${msg}`, data || ''),
            error: (msg, data) => console.error(`[${this.teamName}] ERROR: ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`[${this.teamName}] WARN: ${msg}`, data || '')
        };
    }
    
    // =============================================================================
    // CAPTURA DE CONTEXTO
    // =============================================================================
    
    /**
     * Captura contexto de una tarea
     * @param {string} sessionId - ID de sesión
     * @param {object} taskData - Datos de la tarea
     * @param {object} result - Resultado de la tarea
     * @param {string} priority - Prioridad (low, normal, high)
     */
    async captureContext(sessionId, taskData, result, priority = 'normal') {
        try {
            const contextData = {
                teamId: this.teamId,
                sessionId: sessionId,
                taskType: this.getTaskType(taskData),
                taskData: taskData,
                result: result,
                priority: priority
            };
            
            const response = await axios.post(`${this.contextBridgeUrl}/api/v2/context/capture`, contextData, {
                timeout: 10000
            });
            
            this.stats.context_captures++;
            this.logger.info('Context captured successfully', { 
                context_id: response.data.context_id,
                task_type: contextData.taskType
            });
            
            return response.data;
            
        } catch (error) {
            this.logger.error('Failed to capture context', { error: error.message, taskData });
            throw error;
        }
    }
    
    // =============================================================================
    // RECUPERACIÓN DE CONTEXTO
    // =============================================================================
    
    /**
     * Recupera contexto relevante para una consulta
     * @param {string} sessionId - ID de sesión (opcional)
     * @param {string} query - Consulta semántica
     * @param {number} limit - Límite de resultados
     */
    async retrieveContext(sessionId = null, query = null, limit = 10) {
        try {
            const params = { 
                teamId: this.teamId, 
                limit: limit.toString() 
            };
            
            if (sessionId) params.sessionId = sessionId;
            if (query) params.query = query;
            
            const response = await axios.get(`${this.contextBridgeUrl}/api/v2/context/retrieve`, { 
                params,
                timeout: 10000
            });
            
            this.stats.context_retrievals++;
            this.logger.info('Context retrieved successfully', { 
                source: response.data.source,
                count: response.data.data?.length || 0
            });
            
            return response.data.data;
            
        } catch (error) {
            this.logger.error('Failed to retrieve context', { error: error.message, query });
            throw error;
        }
    }
    
    // =============================================================================
    // BÚSQUEDA SEMÁNTICA
    // =============================================================================
    
    /**
     * Realiza búsqueda semántica en el contexto usando pgvector
     * @param {string} query - Consulta en lenguaje natural
     * @param {string} sessionId - ID de sesión (opcional)
     * @param {number} threshold - Umbral de similitud
     * @param {number} limit - Límite de resultados
     */
    async semanticSearch(query, sessionId = null, threshold = 0.7, limit = 10) {
        try {
            const searchData = {
                query: query,
                teamId: this.teamId,
                sessionId: sessionId,
                threshold: threshold,
                limit: limit
            };
            
            const response = await axios.post(`${this.contextBridgeUrl}/api/v2/context/semantic-search`, searchData, {
                timeout: 15000
            });
            
            this.logger.info('Semantic search completed', { 
                query: query,
                results_count: response.data.count
            });
            
            return response.data.results;
            
        } catch (error) {
            this.logger.error('Semantic search failed', { error: error.message, query });
            throw error;
        }
    }
    
    // =============================================================================
    // CONTEXTO TRANS-SESIONAL
    // =============================================================================
    
    /**
     * Recupera contexto histórico a través de sesiones
     * @param {number} limit - Límite de sesiones
     * @param {number} days - Días hacia atrás
     */
    async getTransSessionContext(limit = 20, days = 30) {
        try {
            const response = await axios.get(
                `${this.contextBridgeUrl}/api/v2/context/transsession/${this.teamId}`,
                { 
                    params: { limit: limit.toString(), days: days.toString() },
                    timeout: 10000
                }
            );
            
            this.logger.info('Trans-sessional context retrieved', { 
                sessions: response.data.total_sessions
            });
            
            return response.data.sessions;
            
        } catch (error) {
            this.logger.error('Failed to get trans-sessional context', { error: error.message });
            throw error;
        }
    }
    
    // =============================================================================
    // OPTIMIZACIÓN INTELIGENTE
    // =============================================================================
    
    /**
     * Analiza patrones de uso y sugiere optimizaciones
     */
    async getOptimizationRecommendations() {
        try {
            const response = await axios.get(
                `${this.contextBridgeUrl}/api/v2/context/optimize/${this.teamId}`,
                { timeout: 10000 }
            );
            
            this.logger.info('Optimization analysis completed', { 
                patterns: response.data.analysis.patterns.length,
                recommendations: response.data.analysis.recommendations.length
            });
            
            return response.data.analysis;
            
        } catch (error) {
            this.logger.error('Failed to get optimization recommendations', { error: error.message });
            throw error;
        }
    }
    
    // =============================================================================
    // MÉTODOS DE UTILIDAD
    // =============================================================================
    
    /**
     * Determina el tipo de tarea basado en los datos
     */
    getTaskType(taskData) {
        if (taskData.type) return taskData.type;
        if (taskData.action) return taskData.action;
        if (taskData.requestType) return taskData.requestType;
        return 'general_task';
    }
    
    /**
     * Enriquce una tarea con contexto histórico
     * @param {object} baseTask - Tarea base
     * @param {string} sessionId - ID de sesión
     */
    async enhanceTaskWithContext(baseTask, sessionId) {
        try {
            // Recuperar contexto relevante
            const context = await this.retrieveContext(sessionId, baseTask.prompt || baseTask.description);
            
            // Realizar búsqueda semántica si hay prompt
            let semanticResults = [];
            if (baseTask.prompt) {
                semanticResults = await this.semanticSearch(baseTask.prompt, sessionId, 0.6, 5);
            }
            
            // Combinar contexto
            const enhancedTask = {
                ...baseTask,
                context: {
                    historical: context || [],
                    semantic: semanticResults,
                    teamId: this.teamId,
                    teamName: this.teamName,
                    timestamp: new Date().toISOString()
                }
            };
            
            this.logger.info('Task enhanced with context', { 
                historical_count: context?.length || 0,
                semantic_count: semanticResults.length
            });
            
            return enhancedTask;
            
        } catch (error) {
            this.logger.warn('Failed to enhance task with context, using base task', { error: error.message });
            return baseTask;
        }
    }
    
    /**
     * Procesa una tarea con capacidades de contexto
     * @param {object} task - Tarea a procesar
     * @param {string} sessionId - ID de sesión
     */
    async processTaskWithContext(task, sessionId) {
        const startTime = Date.now();
        this.isProcessing = true;
        
        try {
            // Enriqucer tarea con contexto
            const enhancedTask = await this.enhanceTaskWithContext(task, sessionId);
            
            // Procesar tarea (implementar en clase hija)
            const result = await this.processTask(enhancedTask, sessionId);
            
            // Capturar contexto del resultado
            await this.captureContext(sessionId, task, result, task.priority || 'normal');
            
            // Actualizar estadísticas
            this.stats.tasks_processed++;
            this.stats.successful_tasks++;
            this.updateAverageResponseTime(Date.now() - startTime);
            
            this.logger.info('Task processed successfully with context', { 
                task_type: this.getTaskType(task),
                response_time: Date.now() - startTime
            });
            
            return result;
            
        } catch (error) {
            this.stats.tasks_processed++;
            this.stats.failed_tasks++;
            this.updateAverageResponseTime(Date.now() - startTime);
            
            this.logger.error('Task processing failed', { 
                error: error.message,
                task_type: this.getTaskType(task)
            });
            
            // Capturar contexto del error
            try {
                await this.captureContext(sessionId, task, { error: error.message }, 'high');
            } catch (captureError) {
                this.logger.error('Failed to capture error context', { error: captureError.message });
            }
            
            throw error;
            
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Actualiza el tiempo promedio de respuesta
     */
    updateAverageResponseTime(newTime) {
        this.stats.average_response_time = (this.stats.average_response_time * 0.9) + (newTime * 0.1);
    }
    
    /**
     * Obtiene estadísticas del equipo
     */
    getStats() {
        return {
            ...this.stats,
            teamId: this.teamId,
            teamName: this.teamName,
            teamType: this.teamType,
            isProcessing: this.isProcessing,
            success_rate: this.stats.tasks_processed > 0 ? 
                (this.stats.successful_tasks / this.stats.tasks_processed * 100).toFixed(2) + '%' : '0%',
            context_enhancement_rate: this.stats.context_captures > 0 ? 
                (this.stats.context_captures / this.stats.tasks_processed * 100).toFixed(2) + '%' : '0%'
        };
    }
    
    // =============================================================================
    // MÉTODOS ABSTRACTOS (implementar en clases hijas)
    // =============================================================================
    
    /**
     * Procesa una tarea (implementar en clase hija)
     * @param {object} task - Tarea a procesar
     * @param {string} sessionId - ID de sesión
     */
    async processTask(task, sessionId) {
        throw new Error('processTask method must be implemented by subclass');
    }
    
    /**
     * Health check del equipo (implementar en clase hija)
     */
    async healthCheck() {
        return {
            status: 'healthy',
            teamId: this.teamId,
            teamName: this.teamName,
            capabilities: ['context-aware'],
            stats: this.getStats()
        };
    }
}

module.exports = ContextAwareTeam;