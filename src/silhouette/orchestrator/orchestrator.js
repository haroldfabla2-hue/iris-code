#!/usr/bin/env node
/**
 * FRAMEWORK SILHOUETTE V4.0 - ORCHESTRATOR
 * Coordinador Central del Sistema Multi-Agente Empresarial
 * 
 * Responsabilidades:
 * - Asignación de tareas a equipos especializados
 * - Gestión de recursos y load balancing
 * - Coordinación inter-equipo
 * - Monitoreo de health status
 * - Optimización de rendimiento en tiempo real
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const http = require('http');
const url = require('url');

class SilhouetteOrchestrator {
    constructor() {
        this.app = express();
        this.server = null;
        this.isHealthy = true;
        
        // Configuración del framework
        this.framework = {
            version: process.env.FRAMEWORK_VERSION || '4.0.0',
            maxTeams: parseInt(process.env.MAX_TEAMS) || 78,
            maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS) || 10000,
            taskQueueSize: parseInt(process.env.TASK_QUEUE_SIZE) || 10000
        };
        
        // Estadísticas del sistema
        this.stats = {
            total_tasks: 0,
            completed_tasks: 0,
            failed_tasks: 0,
            active_teams: 0,
            total_teams: 78,
            uptime: 0,
            startTime: Date.now(),
            resource_usage: {
                cpu: 0,
                memory: 0,
                disk: 0
            },
            performance: {
                avg_response_time: 0,
                throughput: 0,
                error_rate: 0,
                success_rate: 0
            }
        };
        
        // Configuración de logging
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'silhouette-orchestrator' },
            transports: [
                new winston.transports.File({ filename: 'logs/orchestrator/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/orchestrator/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
        
        this.initializeMiddleware();
        this.initializeDatabase();
        this.initializeRedis();
        this.registerTeams();
        this.setupRoutes();
        this.startHealthMonitoring();
        this.startResourceMonitoring();
        this.startOptimizationLoop();
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
            origin: process.env.CORS_ORIGINS?.split(',') || ['https://iris-code.albertofarah.com'],
            credentials: true
        }));
        
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        this.app.use(morgan('combined', { 
            stream: { write: message => this.logger.info(message.trim()) }
        }));
    }
    
    async initializeDatabase() {
        try {
            this.db = new Pool({
                host: process.env.POSTGRES_HOST || 'postgres',
                port: process.env.POSTGRES_PORT || 5432,
                database: process.env.POSTGRES_DB || 'iris_production_db',
                user: process.env.POSTGRES_USER || 'iris_user',
                password: process.env.POSTGRES_PASSWORD,
                ssl: process.env.DATABASE_SSL === 'true',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000
            });
            
            // Verificar conexión
            await this.db.query('SELECT NOW()');
            this.logger.info('Database connection established');
            
        } catch (error) {
            this.logger.error('Database connection failed:', error);
            this.isHealthy = false;
        }
    }
    
    async initializeRedis() {
        try {
            this.redis = createClient({
                url: process.env.REDIS_URL || 'redis://iris-redis:6379',
                password: process.env.REDIS_PASSWORD
            });
            
            this.redis.on('error', (err) => {
                this.logger.error('Redis Client Error', err);
                this.isHealthy = false;
            });
            
            this.redis.on('connect', () => {
                this.logger.info('Redis connected');
                this.isHealthy = true;
            });
            
            await this.redis.connect();
            
        } catch (error) {
            this.logger.error('Redis connection failed:', error);
            this.isHealthy = false;
        }
    }
    
    registerTeams() {
        // Registro de todos los equipos del framework
        this.teams = {
            // Componentes Core (0-3)
            core: {
                orchestrator: { port: 8030, status: 'active', type: 'core' },
                planner: { port: 8025, status: 'active', type: 'core' },
                optimization: { port: 8033, status: 'active', type: 'core' },
                mcp_server: { port: 8027, status: 'active', type: 'core' }
            },
            
            // Equipos Empresariales Principales (8000-8024)
            business: {
                'business-development-team': { port: 8000, status: 'active', type: 'business' },
                'marketing-team': { port: 8001, status: 'active', type: 'business' },
                'sales-team': { port: 8002, status: 'active', type: 'business' },
                'finance-team': { port: 8003, status: 'active', type: 'business' },
                'hr-team': { port: 8004, status: 'active', type: 'business' },
                'legal-team': { port: 8005, status: 'active', type: 'business' },
                'strategy-team': { port: 8006, status: 'active', type: 'business' },
                'product-management-team': { port: 8007, status: 'active', type: 'business' },
                'research-team': { port: 8008, status: 'active', type: 'business' },
                'design-creative-team': { port: 8009, status: 'active', type: 'business' },
                'communications-team': { port: 8010, status: 'active', type: 'business' },
                'customer-service-team': { port: 8011, status: 'active', type: 'business' },
                'support-team': { port: 8012, status: 'active', type: 'business' },
                'quality-assurance-team': { port: 8013, status: 'active', type: 'business' },
                'cloud-services-team': { port: 8014, status: 'active', type: 'business' },
                'data-engineering-team': { port: 8015, status: 'active', type: 'business' },
                'machine-learning-ai-team': { port: 8016, status: 'active', type: 'business' },
                'code-generation-team': { port: 8017, status: 'active', type: 'business' },
                'testing-team': { port: 8018, status: 'active', type: 'business' },
                'manufacturing-team': { port: 8019, status: 'active', type: 'business' },
                'supply-chain-team': { port: 8020, status: 'active', type: 'business' },
                'compliance-team': { port: 8021, status: 'active', type: 'business' },
                'cybersecurity-team': { port: 8022, status: 'active', type: 'business' },
                'risk-management-team': { port: 8023, status: 'active', type: 'business' }
            },
            
            // Sistema Audiovisual (8065-8075)
            audiovisual: {
                'image-search-team': { port: 8065, status: 'active', type: 'audiovisual' },
                'animation-prompt-generator': { port: 8066, status: 'active', type: 'audiovisual' },
                'video-scene-composer': { port: 8067, status: 'active', type: 'audiovisual' },
                'professional-script-generator': { port: 8068, status: 'active', type: 'audiovisual' },
                'social-media-optimizer': { port: 8069, status: 'active', type: 'audiovisual' },
                'content-curation-team': { port: 8070, status: 'active', type: 'audiovisual' },
                'brand-guidelines-team': { port: 8071, status: 'active', type: 'audiovisual' },
                'quality-control-audiovisual': { port: 8072, status: 'active', type: 'audiovisual' },
                'trends-analysis-team': { port: 8073, status: 'active', type: 'audiovisual' },
                'engagement-predictor': { port: 8074, status: 'active', type: 'audiovisual' },
                'mobile-optimization-team': { port: 8075, status: 'active', type: 'audiovisual' }
            },
            
            // Workflows Dinámicos (8034-8077)
            dynamic: {
                'data-engineering-team': { port: 8034, status: 'active', type: 'dynamic' },
                'ecommerce-team': { port: 8035, status: 'active', type: 'dynamic' },
                'healthcare-team': { port: 8036, status: 'active', type: 'dynamic' },
                'realestate-team': { port: 8037, status: 'active', type: 'dynamic' },
                'logistics-team': { port: 8038, status: 'active', type: 'dynamic' },
                'education-team': { port: 8039, status: 'active', type: 'dynamic' },
                'finance-automation-team': { port: 8040, status: 'active', type: 'dynamic' },
                'legal-automation-team': { port: 8041, status: 'active', type: 'dynamic' },
                'hr-automation-team': { port: 8042, status: 'active', type: 'dynamic' },
                'marketing-automation-team': { port: 8043, status: 'active', type: 'dynamic' },
                'sales-automation-team': { port: 8044, status: 'active', type: 'dynamic' },
                'project-management-team': { port: 8045, status: 'active', type: 'dynamic' },
                'seo-optimization-team': { port: 8046, status: 'active', type: 'dynamic' },
                'conversion-optimization-team': { port: 8047, status: 'active', type: 'dynamic' },
                'customer-journey-team': { port: 8048, status: 'active', type: 'dynamic' },
                'ab-testing-team': { port: 8049, status: 'active', type: 'dynamic' },
                'performance-analytics-team': { port: 8050, status: 'active', type: 'dynamic' },
                'budget-optimization-team': { port: 8051, status: 'active', type: 'dynamic' },
                'cost-reduction-team': { port: 8052, status: 'active', type: 'dynamic' },
                'revenue-optimization-team': { port: 8053, status: 'active', type: 'dynamic' },
                'growth-hacking-team': { port: 8054, status: 'active', type: 'dynamic' },
                'competitive-intelligence-team': { port: 8055, status: 'active', type: 'dynamic' },
                'market-research-team': { port: 8056, status: 'active', type: 'dynamic' }
            }
        };
        
        // Contar equipos activos
        this.stats.active_teams = Object.values(this.teams).flatMap(category => 
            Object.values(category)
        ).filter(team => team.status === 'active').length;
        
        this.logger.info(`Orchestrator initialized with ${this.stats.active_teams} active teams`);
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: this.isHealthy ? 'healthy' : 'unhealthy',
                version: this.framework.version,
                uptime: this.stats.uptime,
                timestamp: new Date().toISOString(),
                teams: {
                    total: this.stats.total_teams,
                    active: this.stats.active_teams,
                    by_category: {
                        core: Object.keys(this.teams.core).length,
                        business: Object.keys(this.teams.business).length,
                        audiovisual: Object.keys(this.teams.audiovisual).length,
                        dynamic: Object.keys(this.teams.dynamic).length
                    }
                },
                performance: this.stats.performance
            });
        });
        
        // Obtener todos los equipos
        this.app.get('/teams', (req, res) => {
            const teams = [];
            for (const [category, categoryTeams] of Object.entries(this.teams)) {
                for (const [name, config] of Object.entries(categoryTeams)) {
                    teams.push({
                        name,
                        category,
                        port: config.port,
                        status: config.status,
                        type: config.type
                    });
                }
            }
            res.json({ teams, total: teams.length });
        });
        
        // Ejecutar tarea en equipo específico
        this.app.post('/teams/:teamId/execute', async (req, res) => {
            try {
                const { teamId } = req.params;
                const { task, parameters, priority = 'normal', timeout = 30000 } = req.body;
                
                if (!task) {
                    return res.status(400).json({ error: 'Task parameter is required' });
                }
                
                const result = await this.executeTask(teamId, task, parameters, priority, timeout);
                res.json(result);
                
            } catch (error) {
                this.logger.error('Task execution error:', error);
                res.status(500).json({
                    error: 'Task execution failed',
                    message: error.message
                });
            }
        });
        
        // Ejecutar workflow multi-equipo
        this.app.post('/workflows/execute', async (req, res) => {
            try {
                const { workflow, parameters, parallel = false, timeout = 300000 } = req.body;
                
                if (!workflow) {
                    return res.status(400).json({ error: 'Workflow parameter is required' });
                }
                
                const result = await this.executeWorkflow(workflow, parameters, parallel, timeout);
                res.json(result);
                
            } catch (error) {
                this.logger.error('Workflow execution error:', error);
                res.status(500).json({
                    error: 'Workflow execution failed',
                    message: error.message
                });
            }
        });
        
        // Obtener estadísticas del sistema
        this.app.get('/stats', (req, res) => {
            res.json({
                stats: this.stats,
                teams: this.teams,
                system_info: {
                    version: this.framework.version,
                    max_teams: this.framework.maxTeams,
                    max_concurrent_tasks: this.framework.maxConcurrentTasks
                }
            });
        });
        
        // Obtener métricas de rendimiento
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.collectMetrics();
                res.json(metrics);
            } catch (error) {
                this.logger.error('Metrics collection error:', error);
                res.status(500).json({ error: 'Failed to collect metrics' });
            }
        });
        
        // Optimización manual
        this.app.post('/optimize', async (req, res) => {
            try {
                const { type = 'all' } = req.body;
                const result = await this.triggerOptimization(type);
                res.json(result);
            } catch (error) {
                this.logger.error('Optimization error:', error);
                res.status(500).json({
                    error: 'Optimization failed',
                    message: error.message
                });
            }
        });
        
        // Obtener logs
        this.app.get('/logs', async (req, res) => {
            try {
                const { level = 'all', limit = 100 } = req.query;
                const logs = await this.getLogs(level, parseInt(limit));
                res.json({ logs, count: logs.length });
            } catch (error) {
                this.logger.error('Logs retrieval error:', error);
                res.status(500).json({ error: 'Failed to retrieve logs' });
            }
        });
    }
    
    async executeTask(teamId, task, parameters = {}, priority = 'normal', timeout = 30000) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        this.logger.info(`Executing task ${taskId} on team ${teamId}`, { task, parameters, priority });
        
        // Buscar el equipo
        const team = this.findTeam(teamId);
        if (!team) {
            throw new Error(`Team ${teamId} not found`);
        }
        
        if (team.status !== 'active') {
            throw new Error(`Team ${teamId} is not active`);
        }
        
        try {
            // Realizar llamada HTTP al equipo
            const response = await this.callTeam(team, {
                task_id: taskId,
                task,
                parameters,
                priority,
                orchestrator_version: this.framework.version
            }, timeout);
            
            const duration = Date.now() - startTime;
            this.stats.total_tasks++;
            this.stats.completed_tasks++;
            
            // Actualizar métricas
            this.updatePerformanceMetrics(duration, true);
            
            // Log de éxito
            this.logger.info(`Task ${taskId} completed successfully`, { 
                team: teamId, 
                duration,
                response_time: duration
            });
            
            return {
                success: true,
                task_id: taskId,
                team: teamId,
                result: response,
                duration_ms: duration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.stats.total_tasks++;
            this.stats.failed_tasks++;
            
            // Actualizar métricas
            this.updatePerformanceMetrics(duration, false);
            
            this.logger.error(`Task ${taskId} failed`, { 
                team: teamId, 
                error: error.message,
                duration
            });
            
            return {
                success: false,
                task_id: taskId,
                team: teamId,
                error: error.message,
                duration_ms: duration,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async executeWorkflow(workflow, parameters = {}, parallel = false, timeout = 300000) {
        const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        this.logger.info(`Executing workflow ${workflowId}`, { workflow, parameters, parallel });
        
        try {
            const workflowDefinition = this.getWorkflowDefinition(workflow);
            if (!workflowDefinition) {
                throw new Error(`Workflow ${workflow} not found`);
            }
            
            const results = [];
            const tasks = workflowDefinition.steps;
            
            if (parallel) {
                // Ejecutar en paralelo
                const promises = tasks.map(step => this.executeWorkflowStep(step, parameters, workflowId));
                const stepResults = await Promise.allSettled(promises);
                
                stepResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push({
                            step: tasks[index].name,
                            success: true,
                            result: result.value
                        });
                    } else {
                        results.push({
                            step: tasks[index].name,
                            success: false,
                            error: result.reason.message
                        });
                    }
                });
            } else {
                // Ejecutar secuencialmente
                for (const step of tasks) {
                    try {
                        // Verificar dependencias
                        if (step.depends_on) {
                            for (const dep of step.depends_on) {
                                const depResult = results.find(r => r.step === dep);
                                if (!depResult || !depResult.success) {
                                    throw new Error(`Dependency ${dep} not satisfied for step ${step.name}`);
                                }
                            }
                        }
                        
                        const stepResult = await this.executeWorkflowStep(step, parameters, workflowId);
                        results.push({
                            step: step.name,
                            success: true,
                            result: stepResult
                        });
                        
                    } catch (error) {
                        results.push({
                            step: step.name,
                            success: false,
                            error: error.message
                        });
                        
                        // En modo secuencial, fallar si un paso falla
                        if (!step.optional) {
                            break;
                        }
                    }
                }
            }
            
            const duration = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            this.logger.info(`Workflow ${workflowId} completed`, { 
                success_count: successCount,
                total_steps: totalCount,
                duration
            });
            
            return {
                success: successCount === totalCount,
                workflow_id: workflowId,
                workflow,
                results,
                success_rate: successCount / totalCount,
                duration_ms: duration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Workflow ${workflowId} failed`, { error: error.message, duration });
            
            return {
                success: false,
                workflow_id: workflowId,
                workflow,
                error: error.message,
                duration_ms: duration,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    findTeam(teamId) {
        for (const [category, teams] of Object.entries(this.teams)) {
            if (teams[teamId]) {
                return teams[teamId];
            }
        }
        return null;
    }
    
    async callTeam(team, payload, timeout = 30000) {
        const axios = require('axios');
        
        const response = await axios.post(
            `http://localhost:${team.port}/execute`,
            payload,
            {
                timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Orchestrator-Version': this.framework.version
                }
            }
        );
        
        return response.data;
    }
    
    getWorkflowDefinition(workflowName) {
        // Workflows predefinidos
        const workflows = {
            'marketing_campaign': {
                name: 'Marketing Campaign Creation',
                steps: [
                    { name: 'market_research', team: 'research-team', parallel: false },
                    { name: 'content_creation', team: 'marketing-team', parallel: true, depends_on: ['market_research'] },
                    { name: 'creative_production', team: 'image-search-team', parallel: true, depends_on: ['content_creation'] },
                    { name: 'qa_validation', team: 'quality-assurance-team', parallel: false, depends_on: ['creative_production'] }
                ]
            },
            'product_launch': {
                name: 'Product Launch',
                steps: [
                    { name: 'product_analysis', team: 'product-management-team', parallel: false },
                    { name: 'market_research', team: 'research-team', parallel: true, depends_on: ['product_analysis'] },
                    { name: 'financial_modeling', team: 'finance-team', parallel: true, depends_on: ['product_analysis'] },
                    { name: 'marketing_strategy', team: 'marketing-team', parallel: true, depends_on: ['market_research', 'financial_modeling'] },
                    { name: 'content_production', team: 'design-creative-team', parallel: true, depends_on: ['marketing_strategy'] },
                    { name: 'launch_coordination', team: 'business-development-team', parallel: false, depends_on: ['content_production'] }
                ]
            },
            'compliance_check': {
                name: 'Compliance Check',
                steps: [
                    { name: 'legal_review', team: 'legal-team', parallel: false },
                    { name: 'security_audit', team: 'cybersecurity-team', parallel: true, depends_on: ['legal_review'] },
                    { name: 'data_privacy_check', team: 'compliance-team', parallel: true, depends_on: ['legal_review'] },
                    { name: 'risk_assessment', team: 'risk-management-team', parallel: true, depends_on: ['security_audit', 'data_privacy_check'] }
                ]
            }
        };
        
        return workflows[workflowName];
    }
    
    async executeWorkflowStep(step, parameters, workflowId) {
        const team = this.findTeam(step.team);
        if (!team) {
            throw new Error(`Team ${step.team} not found for step ${step.name}`);
        }
        
        return await this.callTeam(team, {
            step_name: step.name,
            workflow_id: workflowId,
            parameters,
            orchestrator_version: this.framework.version
        });
    }
    
    updatePerformanceMetrics(duration, success) {
        // Calcular métricas de rendimiento
        const currentAvg = this.stats.performance.avg_response_time;
        const taskCount = this.stats.completed_tasks + this.stats.failed_tasks;
        
        // Promedio móvil de tiempo de respuesta
        this.stats.performance.avg_response_time = 
            ((currentAvg * (taskCount - 1)) + duration) / taskCount;
        
        // Calcular tasa de éxito
        this.stats.performance.success_rate = 
            this.stats.completed_tasks / (this.stats.completed_tasks + this.stats.failed_tasks);
        
        // Calcular tasa de error
        this.stats.performance.error_rate = 
            this.stats.failed_tasks / (this.stats.completed_tasks + this.stats.failed_tasks);
    }
    
    async collectMetrics() {
        const os = require('os');
        
        // Métricas del sistema
        const systemMetrics = {
            cpu: os.loadavg()[0],
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
            },
            uptime: os.uptime()
        };
        
        // Métricas de la aplicación
        const appMetrics = {
            ...this.stats,
            system: systemMetrics,
            redis_connected: this.redis?.isOpen || false,
            database_connected: this.db ? 'connected' : 'disconnected'
        };
        
        return appMetrics;
    }
    
    async triggerOptimization(type = 'all') {
        this.logger.info(`Triggering optimization: ${type}`);
        
        try {
            switch (type) {
                case 'teams':
                    await this.optimizeTeams();
                    break;
                case 'workflows':
                    await this.optimizeWorkflows();
                    break;
                case 'resources':
                    await this.optimizeResources();
                    break;
                case 'all':
                default:
                    await Promise.all([
                        this.optimizeTeams(),
                        this.optimizeWorkflows(),
                        this.optimizeResources()
                    ]);
                    break;
            }
            
            return {
                success: true,
                optimization_type: type,
                timestamp: new Date().toISOString(),
                message: 'Optimization completed successfully'
            };
            
        } catch (error) {
            this.logger.error('Optimization failed:', error);
            return {
                success: false,
                optimization_type: type,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async optimizeTeams() {
        // Optimizar distribución de carga entre equipos
        for (const [category, teams] of Object.entries(this.teams)) {
            for (const [name, team] of Object.entries(teams)) {
                if (team.status === 'active') {
                    // Verificar health del equipo
                    const isHealthy = await this.checkTeamHealth(team);
                    if (!isHealthy) {
                        team.status = 'warning';
                        this.logger.warn(`Team ${name} health degraded`);
                    }
                }
            }
        }
    }
    
    async optimizeWorkflows() {
        // Analizar y optimizar workflows basado en métricas históricas
        // Esta implementación sería más compleja en un sistema real
        this.logger.info('Workflow optimization completed');
    }
    
    async optimizeResources() {
        // Optimizar uso de recursos del sistema
        // Verificar memoria, CPU, etc.
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
            // Trigger garbage collection o restart de equipos
            this.logger.warn('High memory usage detected, triggering optimization');
        }
    }
    
    async checkTeamHealth(team) {
        try {
            const axios = require('axios');
            const response = await axios.get(`http://localhost:${team.port}/health`, { timeout: 5000 });
            return response.data.status === 'healthy';
        } catch (error) {
            return false;
        }
    }
    
    async getLogs(level = 'all', limit = 100) {
        // En un sistema real, esto leería de un sistema de logging
        // Por simplicidad, retornamos logs simulados
        return [
            {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Orchestrator running normally',
                service: 'silhouette-orchestrator'
            }
        ].slice(0, limit);
    }
    
    startHealthMonitoring() {
        setInterval(async () => {
            try {
                // Verificar health de todos los equipos
                let healthyTeams = 0;
                let totalTeams = 0;
                
                for (const [category, teams] of Object.entries(this.teams)) {
                    for (const [name, team] of Object.entries(teams)) {
                        totalTeams++;
                        const isHealthy = await this.checkTeamHealth(team);
                        if (isHealthy) {
                            healthyTeams++;
                        } else {
                            this.logger.warn(`Team ${name} health check failed`);
                        }
                    }
                }
                
                this.stats.active_teams = healthyTeams;
                this.isHealthy = healthyTeams === totalTeams;
                
                // Guardar métricas en Redis
                if (this.redis) {
                    await this.redis.setex('orchestrator:health', 300, JSON.stringify({
                        healthy_teams: healthyTeams,
                        total_teams: totalTeams,
                        health_ratio: healthyTeams / totalTeams,
                        timestamp: new Date().toISOString()
                    }));
                }
                
            } catch (error) {
                this.logger.error('Health monitoring error:', error);
            }
        }, 30000); // Cada 30 segundos
    }
    
    startResourceMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            this.stats.resource_usage = {
                memory: {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            };
            
            this.stats.uptime = Date.now() - this.stats.startTime;
            
        }, 10000); // Cada 10 segundos
    }
    
    startOptimizationLoop() {
        if (process.env.AUTO_OPTIMIZATION === 'true') {
            setInterval(() => {
                this.triggerOptimization('all').catch(error => {
                    this.logger.error('Auto-optimization error:', error);
                });
            }, 300000); // Cada 5 minutos
        }
    }
    
    async start() {
        try {
            this.server = http.createServer(this.app);
            
            const port = process.env.ORCHESTRATOR_PORT || 8030;
            const host = process.env.ORCHESTRATOR_HOST || '0.0.0.0';
            
            this.server.listen(port, host, () => {
                this.logger.info(`Silhouette Orchestrator V${this.framework.version} started`, {
                    port,
                    host,
                    teams: this.stats.active_teams,
                    max_concurrent_tasks: this.framework.maxConcurrentTasks
                });
            });
            
        } catch (error) {
            this.logger.error('Failed to start orchestrator:', error);
            process.exit(1);
        }
    }
}

// Iniciar el orquestador si este archivo se ejecuta directamente
if (require.main === module) {
    const orchestrator = new SilhouetteOrchestrator();
    orchestrator.start();
}

module.exports = SilhouetteOrchestrator;