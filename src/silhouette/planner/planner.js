#!/usr/bin/env node
/**
 * FRAMEWORK SILHOUETTE V4.0 - PLANNER
 * Sistema de Planificación y Optimización de Workflows
 * 
 * Responsabilidades:
 * - Análisis de dependencias de tareas
 * - Optimización de rutas de trabajo
 * - Scheduling de recursos
 * - Predicción de performance
 * - Optimización de workflows en tiempo real
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const http = require('http');

class SilhouettePlanner {
    constructor() {
        this.app = express();
        this.server = null;
        this.isHealthy = true;
        
        // Configuración del planner
        this.config = {
            workers: parseInt(process.env.PLANNER_WORKERS) || 4,
            workflowCacheSize: parseInt(process.env.WORKFLOW_CACHE_SIZE) || 1000,
            optimizationInterval: parseInt(process.env.OPTIMIZATION_INTERVAL) || 30000,
            learningRate: parseFloat(process.env.LEARNING_RATE) || 0.001
        };
        
        // Estadísticas del planner
        this.stats = {
            workflows_planned: 0,
            workflows_optimized: 0,
            dependencies_resolved: 0,
            resources_scheduled: 0,
            performance_predictions: 0,
            cache_hits: 0,
            cache_misses: 0,
            optimization_cycles: 0,
            avg_planning_time: 0,
            avg_optimization_time: 0,
            uptime: 0,
            startTime: Date.now()
        };
        
        // Cache de workflows
        this.workflowCache = new Map();
        this.workflowDefinitions = new Map();
        
        // Configuración de logging
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'silhouette-planner' },
            transports: [
                new winston.transports.File({ filename: 'logs/planner/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/planner/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
        
        this.initializeMiddleware();
        this.initializeDatabase();
        this.initializeRedis();
        this.loadWorkflowDefinitions();
        this.setupRoutes();
        this.startOptimizationLoop();
        this.startPerformanceMonitoring();
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
        
        this.app.use(express.json({ limit: '10mb' }));
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
            
            await this.redis.connect();
            this.logger.info('Redis connected');
            
        } catch (error) {
            this.logger.error('Redis connection failed:', error);
            this.isHealthy = false;
        }
    }
    
    loadWorkflowDefinitions() {
        // Cargar definiciones de workflows predefinidos
        const workflows = {
            'marketing_campaign': {
                name: 'Marketing Campaign Creation',
                description: 'Complete marketing campaign from research to execution',
                category: 'business',
                priority: 'high',
                estimated_duration: 3600000, // 1 hora
                teams: ['research-team', 'marketing-team', 'design-creative-team', 'image-search-team'],
                steps: [
                    { 
                        id: 'market_research', 
                        name: 'Market Research', 
                        team: 'research-team', 
                        parallel: false,
                        dependencies: [],
                        estimated_duration: 300000,
                        priority: 'high'
                    },
                    { 
                        id: 'content_creation', 
                        name: 'Content Creation', 
                        team: 'marketing-team', 
                        parallel: false,
                        dependencies: ['market_research'],
                        estimated_duration: 600000,
                        priority: 'high'
                    },
                    { 
                        id: 'creative_production', 
                        name: 'Creative Production', 
                        team: 'image-search-team', 
                        parallel: true,
                        dependencies: ['content_creation'],
                        estimated_duration: 900000,
                        priority: 'medium'
                    },
                    { 
                        id: 'quality_assurance', 
                        name: 'Quality Assurance', 
                        team: 'quality-assurance-team', 
                        parallel: false,
                        dependencies: ['creative_production'],
                        estimated_duration: 180000,
                        priority: 'high'
                    }
                ],
                optimization_rules: [
                    { type: 'parallel_execution', target: 'creative_production' },
                    { type: 'resource_pooling', teams: ['marketing-team', 'design-creative-team'] }
                ]
            },
            
            'product_launch': {
                name: 'Product Launch',
                description: 'Complete product launch from analysis to market entry',
                category: 'business',
                priority: 'critical',
                estimated_duration: 7200000, // 2 horas
                teams: ['product-management-team', 'research-team', 'finance-team', 'marketing-team', 'design-creative-team', 'business-development-team'],
                steps: [
                    { 
                        id: 'product_analysis', 
                        name: 'Product Analysis', 
                        team: 'product-management-team', 
                        parallel: false,
                        dependencies: [],
                        estimated_duration: 600000,
                        priority: 'critical'
                    },
                    { 
                        id: 'market_research', 
                        name: 'Market Research', 
                        team: 'research-team', 
                        parallel: true,
                        dependencies: ['product_analysis'],
                        estimated_duration: 900000,
                        priority: 'high'
                    },
                    { 
                        id: 'financial_modeling', 
                        name: 'Financial Modeling', 
                        team: 'finance-team', 
                        parallel: true,
                        dependencies: ['product_analysis'],
                        estimated_duration: 720000,
                        priority: 'critical'
                    },
                    { 
                        id: 'marketing_strategy', 
                        name: 'Marketing Strategy', 
                        team: 'marketing-team', 
                        parallel: false,
                        dependencies: ['market_research', 'financial_modeling'],
                        estimated_duration: 900000,
                        priority: 'high'
                    },
                    { 
                        id: 'content_production', 
                        name: 'Content Production', 
                        team: 'design-creative-team', 
                        parallel: true,
                        dependencies: ['marketing_strategy'],
                        estimated_duration: 1080000,
                        priority: 'medium'
                    },
                    { 
                        id: 'launch_coordination', 
                        name: 'Launch Coordination', 
                        team: 'business-development-team', 
                        parallel: false,
                        dependencies: ['content_production'],
                        estimated_duration: 300000,
                        priority: 'critical'
                    }
                ],
                optimization_rules: [
                    { type: 'parallel_execution', target: ['market_research', 'financial_modeling'] },
                    { type: 'resource_scaling', teams: ['marketing-team', 'design-creative-team'] }
                ]
            },
            
            'compliance_check': {
                name: 'Compliance Check',
                description: 'Comprehensive compliance and security review',
                category: 'security',
                priority: 'high',
                estimated_duration: 1800000, // 30 minutos
                teams: ['legal-team', 'cybersecurity-team', 'compliance-team', 'risk-management-team'],
                steps: [
                    { 
                        id: 'legal_review', 
                        name: 'Legal Review', 
                        team: 'legal-team', 
                        parallel: false,
                        dependencies: [],
                        estimated_duration: 300000,
                        priority: 'critical'
                    },
                    { 
                        id: 'security_audit', 
                        name: 'Security Audit', 
                        team: 'cybersecurity-team', 
                        parallel: true,
                        dependencies: ['legal_review'],
                        estimated_duration: 600000,
                        priority: 'critical'
                    },
                    { 
                        id: 'data_privacy_check', 
                        name: 'Data Privacy Check', 
                        team: 'compliance-team', 
                        parallel: true,
                        dependencies: ['legal_review'],
                        estimated_duration: 450000,
                        priority: 'high'
                    },
                    { 
                        id: 'risk_assessment', 
                        name: 'Risk Assessment', 
                        team: 'risk-management-team', 
                        parallel: false,
                        dependencies: ['security_audit', 'data_privacy_check'],
                        estimated_duration: 300000,
                        priority: 'high'
                    }
                ],
                optimization_rules: [
                    { type: 'parallel_execution', target: ['security_audit', 'data_privacy_check'] },
                    { type: 'security_focus', priority_boost: 0.2 }
                ]
            },
            
            'content_creation_pipeline': {
                name: 'Content Creation Pipeline',
                description: 'Automated content creation from script to final output',
                category: 'audiovisual',
                priority: 'medium',
                estimated_duration: 2700000, // 45 minutos
                teams: ['professional-script-generator', 'image-search-team', 'animation-prompt-generator', 'video-scene-composer', 'quality-control-audiovisual'],
                steps: [
                    { 
                        id: 'script_generation', 
                        name: 'Script Generation', 
                        team: 'professional-script-generator', 
                        parallel: false,
                        dependencies: [],
                        estimated_duration: 300000,
                        priority: 'high'
                    },
                    { 
                        id: 'image_curation', 
                        name: 'Image Curation', 
                        team: 'image-search-team', 
                        parallel: true,
                        dependencies: ['script_generation'],
                        estimated_duration: 600000,
                        priority: 'medium'
                    },
                    { 
                        id: 'animation_prompts', 
                        name: 'Animation Prompts', 
                        team: 'animation-prompt-generator', 
                        parallel: true,
                        dependencies: ['script_generation'],
                        estimated_duration: 450000,
                        priority: 'medium'
                    },
                    { 
                        id: 'scene_composition', 
                        name: 'Scene Composition', 
                        team: 'video-scene-composer', 
                        parallel: false,
                        dependencies: ['image_curation', 'animation_prompts'],
                        estimated_duration: 900000,
                        priority: 'high'
                    },
                    { 
                        id: 'quality_control', 
                        name: 'Quality Control', 
                        team: 'quality-control-audiovisual', 
                        parallel: false,
                        dependencies: ['scene_composition'],
                        estimated_duration: 300000,
                        priority: 'high'
                    }
                ],
                optimization_rules: [
                    { type: 'parallel_execution', target: ['image_curation', 'animation_prompts'] },
                    { type: 'quality_threshold', minimum: 90 },
                    { type: 'batch_processing', teams: ['image-search-team'] }
                ]
            }
        };
        
        // Cargar workflows en cache y base de datos
        for (const [id, workflow] of Object.entries(workflows)) {
            this.workflowDefinitions.set(id, workflow);
            this.workflowCache.set(id, {
                workflow,
                cached_at: Date.now(),
                access_count: 0
            });
        }
        
        this.logger.info(`Loaded ${workflows.length} workflow definitions`);
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: this.isHealthy ? 'healthy' : 'unhealthy',
                version: '4.0.0',
                uptime: this.stats.uptime,
                workers: this.config.workers,
                cache_size: this.workflowCache.size,
                workflows_loaded: this.workflowDefinitions.size,
                performance: {
                    avg_planning_time: this.stats.avg_planning_time,
                    cache_hit_ratio: this.stats.cache_hits / (this.stats.cache_hits + this.stats.cache_misses)
                }
            });
        });
        
        // Obtener todos los workflows
        this.app.get('/workflows', (req, res) => {
            const workflows = Array.from(this.workflowDefinitions.entries()).map(([id, workflow]) => ({
                id,
                ...workflow
            }));
            
            res.json({ 
                workflows, 
                total: workflows.length,
                categories: [...new Set(workflows.map(w => w.category))]
            });
        });
        
        // Planificar workflow específico
        this.app.post('/workflows/:workflowId/plan', async (req, res) => {
            try {
                const { workflowId } = req.params;
                const { parameters = {}, constraints = {}, optimization_level = 'standard' } = req.body;
                
                const plan = await this.planWorkflow(workflowId, parameters, constraints, optimization_level);
                res.json(plan);
                
            } catch (error) {
                this.logger.error('Workflow planning error:', error);
                res.status(500).json({
                    error: 'Workflow planning failed',
                    message: error.message
                });
            }
        });
        
        // Optimizar workflow existente
        this.app.post('/workflows/:workflowId/optimize', async (req, res) => {
            try {
                const { workflowId } = req.params;
                const { current_execution_data, optimization_goals = {} } = req.body;
                
                const optimization = await this.optimizeWorkflow(workflowId, current_execution_data, optimization_goals);
                res.json(optimization);
                
            } catch (error) {
                this.logger.error('Workflow optimization error:', error);
                res.status(500).json({
                    error: 'Workflow optimization failed',
                    message: error.message
                });
            }
        });
        
        // Analizar dependencias
        this.app.post('/dependencies/analyze', async (req, res) => {
            try {
                const { steps, constraints = {} } = req.body;
                
                const analysis = await this.analyzeDependencies(steps, constraints);
                res.json(analysis);
                
            } catch (error) {
                this.logger.error('Dependency analysis error:', error);
                res.status(500).json({
                    error: 'Dependency analysis failed',
                    message: error.message
                });
            }
        });
        
        // Predecir performance
        this.app.post('/performance/predict', async (req, res) => {
            try {
                const { workflow_id, parameters = {}, historical_data = {} } = req.body;
                
                const prediction = await this.predictPerformance(workflow_id, parameters, historical_data);
                res.json(prediction);
                
            } catch (error) {
                this.logger.error('Performance prediction error:', error);
                res.status(500).json({
                    error: 'Performance prediction failed',
                    message: error.message
                });
            }
        });
        
        // Obtener métricas del planner
        this.app.get('/metrics', (req, res) => {
            res.json({
                stats: this.stats,
                config: this.config,
                cache_info: {
                    size: this.workflowCache.size,
                    hit_rate: this.stats.cache_hits / (this.stats.cache_hits + this.stats.cache_misses),
                    workflows_loaded: this.workflowDefinitions.size
                }
            });
        });
        
        // Limpiar cache
        this.app.post('/cache/clear', (req, res) => {
            const { workflow_id, all = false } = req.body;
            
            if (all) {
                this.workflowCache.clear();
                this.logger.info('All workflow cache cleared');
            } else if (workflow_id) {
                this.workflowCache.delete(workflow_id);
                this.logger.info(`Workflow ${workflow_id} cache cleared`);
            }
            
            res.json({ 
                success: true, 
                cache_size: this.workflowCache.size,
                message: all ? 'All cache cleared' : `Workflow ${workflow_id} cache cleared`
            });
        });
    }
    
    async planWorkflow(workflowId, parameters = {}, constraints = {}, optimization_level = 'standard') {
        const startTime = Date.now();
        this.stats.workflows_planned++;
        
        this.logger.info(`Planning workflow: ${workflowId}`, { parameters, constraints, optimization_level });
        
        try {
            // Obtener definición del workflow
            const workflow = this.workflowDefinitions.get(workflowId);
            if (!workflow) {
                throw new Error(`Workflow ${workflowId} not found`);
            }
            
            // Verificar cache
            const cacheKey = `${workflowId}_${JSON.stringify(parameters)}_${JSON.stringify(constraints)}`;
            const cached = this.workflowCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.cached_at) < 300000) { // 5 minutos
                this.stats.cache_hits++;
                cached.workflow.access_count++;
                return {
                    ...cached.workflow,
                    cached: true,
                    cache_age: Date.now() - cached.cached_at
                };
            }
            
            this.stats.cache_misses++;
            
            // Crear plan optimizado
            const plan = {
                workflow_id: workflowId,
                workflow_name: workflow.name,
                planning_timestamp: new Date().toISOString(),
                optimization_level,
                
                // Análisis de dependencias
                dependency_analysis: await this.analyzeWorkflowDependencies(workflow.steps),
                
                // Plan de ejecución
                execution_plan: this.createExecutionPlan(workflow, parameters, constraints),
                
                // Predicción de recursos
                resource_prediction: await this.predictResourceUsage(workflow, parameters),
                
                // Predicción de performance
                performance_prediction: await this.predictWorkflowPerformance(workflow, parameters),
                
                // Sugerencias de optimización
                optimization_suggestions: this.generateOptimizationSuggestions(workflow, optimization_level),
                
                // Estimaciones de tiempo
                time_estimations: this.calculateTimeEstimations(workflow),
                
                // Validaciones
                validations: this.validatePlan(workflow, constraints)
            };
            
            // Guardar en cache
            this.workflowCache.set(cacheKey, {
                workflow: plan,
                cached_at: Date.now(),
                access_count: 1
            });
            
            const duration = Date.now() - startTime;
            this.stats.avg_planning_time = ((this.stats.avg_planning_time * (this.stats.workflows_planned - 1)) + duration) / this.stats.workflows_planned;
            
            this.logger.info(`Workflow planning completed: ${workflowId}`, { duration, plan_size: JSON.stringify(plan).length });
            
            return plan;
            
        } catch (error) {
            this.logger.error(`Workflow planning failed: ${workflowId}`, { error: error.message });
            throw error;
        }
    }
    
    async analyzeWorkflowDependencies(steps) {
        const dependencies = [];
        const dependencyGraph = new Map();
        
        // Construir grafo de dependencias
        for (const step of steps) {
            dependencyGraph.set(step.id, {
                step,
                dependents: [],
                dependencies: step.dependencies || []
            });
        }
        
        // Analizar dependencias
        for (const [stepId, stepInfo] of dependencyGraph) {
            for (const depId of stepInfo.dependencies) {
                if (dependencyGraph.has(depId)) {
                    dependencies.push({
                        from: depId,
                        to: stepId,
                        type: 'dependency',
                        critical: this.isCriticalPath(depId, stepId, dependencyGraph)
                    });
                    
                    // Agregar dependents
                    dependencyGraph.get(depId).dependents.push(stepId);
                }
            }
        }
        
        // Detectar ciclos
        const cycles = this.detectCycles(dependencyGraph);
        
        // Identificar ruta crítica
        const criticalPath = this.findCriticalPath(dependencyGraph);
        
        this.stats.dependencies_resolved += dependencies.length;
        
        return {
            dependencies,
            dependency_graph: Object.fromEntries(dependencyGraph),
            cycles_detected: cycles,
            critical_path: criticalPath,
            dependency_count: dependencies.length,
            parallelizable_steps: steps.filter(step => (step.dependencies || []).length === 0).length
        };
    }
    
    createExecutionPlan(workflow, parameters, constraints) {
        const plan = {
            phases: [],
            parallel_groups: [],
            sequential_groups: [],
            resource_assignments: {},
            timing_constraints: {}
        };
        
        // Agrupar pasos por paralelismo
        const parallelGroups = this.identifyParallelGroups(workflow.steps);
        const sequentialGroups = this.identifySequentialGroups(workflow.steps);
        
        // Crear fases de ejecución
        for (let phase = 0; phase < Math.max(parallelGroups.length, sequentialGroups.length); phase++) {
            const phasePlan = {
                phase,
                parallel_steps: parallelGroups[phase] || [],
                sequential_steps: sequentialGroups[phase] || [],
                estimated_duration: 0,
                resource_requirements: {}
            };
            
            // Calcular duración de la fase
            const stepDurations = [...(phasePlan.parallel_steps || []), ...(phasePlan.sequential_steps || [])]
                .map(stepId => {
                    const step = workflow.steps.find(s => s.id === stepId);
                    return step?.estimated_duration || 0;
                });
            
            phasePlan.estimated_duration = Math.max(...stepDurations, 0);
            
            plan.phases.push(phasePlan);
        }
        
        return plan;
    }
    
    identifyParallelGroups(steps) {
        const groups = [];
        const processed = new Set();
        const maxIterations = 100; // Prevenir loops infinitos
        
        let iteration = 0;
        while (processed.size < steps.length && iteration < maxIterations) {
            iteration++;
            const currentGroup = [];
            
            for (const step of steps) {
                if (processed.has(step.id)) continue;
                
                // Verificar si todas las dependencias están procesadas
                const dependenciesMet = (step.dependencies || []).every(dep => processed.has(dep));
                
                if (dependenciesMet) {
                    currentGroup.push(step.id);
                }
            }
            
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
                currentGroup.forEach(stepId => processed.add(stepId));
            } else {
                // No se pueden procesar más pasos, romper el loop
                break;
            }
        }
        
        return groups;
    }
    
    identifySequentialGroups(steps) {
        // Para grupos secuenciales, simplemente retornamos los pasos en orden
        return steps.map(step => [step.id]);
    }
    
    isCriticalPath(from, to, dependencyGraph) {
        // Implementación simplificada - en un sistema real sería más compleja
        return dependencyGraph.get(to).dependencies.includes(from);
    }
    
    detectCycles(dependencyGraph) {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        
        const dfs = (nodeId) => {
            if (recursionStack.has(nodeId)) {
                // Ciclo detectado
                cycles.push([...recursionStack, nodeId]);
                return;
            }
            
            if (visited.has(nodeId)) return;
            
            visited.add(nodeId);
            recursionStack.add(nodeId);
            
            const node = dependencyGraph.get(nodeId);
            if (node) {
                for (const dependent of node.dependents) {
                    dfs(dependent);
                }
            }
            
            recursionStack.delete(nodeId);
        };
        
        for (const nodeId of dependencyGraph.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }
        
        return cycles;
    }
    
    findCriticalPath(dependencyGraph) {
        // Implementación simplificada del algoritmo de ruta crítica
        const nodes = Array.from(dependencyGraph.keys());
        const inDegree = new Map();
        const distances = new Map();
        
        // Calcular in-degree
        for (const nodeId of nodes) {
            inDegree.set(nodeId, 0);
            for (const [otherId, node] of dependencyGraph) {
                if (node.dependencies.includes(nodeId)) {
                    inDegree.set(otherId, inDegree.get(otherId) + 1);
                }
            }
        }
        
        // Topological sort con tracking de distancias
        const queue = [];
        for (const [nodeId, degree] of inDegree) {
            if (degree === 0) {
                queue.push(nodeId);
                distances.set(nodeId, 0);
            }
        }
        
        const topologicalOrder = [];
        
        while (queue.length > 0) {
            const current = queue.shift();
            topologicalOrder.push(current);
            
            const currentNode = dependencyGraph.get(current);
            if (currentNode) {
                for (const dependent of currentNode.dependents) {
                    const newDistance = Math.max(
                        distances.get(dependent) || 0,
                        distances.get(current) + (currentNode.step.estimated_duration || 0)
                    );
                    distances.set(dependent, newDistance);
                    
                    inDegree.set(dependent, inDegree.get(dependent) - 1);
                    if (inDegree.get(dependent) === 0) {
                        queue.push(dependent);
                    }
                }
            }
        }
        
        // Encontrar el nodo con mayor distancia
        let maxDistance = 0;
        let criticalNode = null;
        for (const [nodeId, distance] of distances) {
            if (distance > maxDistance) {
                maxDistance = distance;
                criticalNode = nodeId;
            }
        }
        
        return {
            critical_node: criticalNode,
            critical_duration: maxDistance,
            topological_order: topologicalOrder,
            node_distances: Object.fromEntries(distances)
        };
    }
    
    async predictResourceUsage(workflow, parameters) {
        // Simulación de predicción de recursos
        const resourcePrediction = {
            cpu_cores_required: 0,
            memory_gb_required: 0,
            network_bandwidth_mbps: 0,
            storage_gb_required: 0,
            estimated_cost: 0
        };
        
        for (const step of workflow.steps) {
            // Predicciones basadas en el tipo de equipo
            const teamResourceUsage = this.getTeamResourceUsage(step.team);
            
            resourcePrediction.cpu_cores_required += teamResourceUsage.cpu;
            resourcePrediction.memory_gb_required += teamResourceUsage.memory;
            resourcePrediction.network_bandwidth_mbps += teamResourceUsage.network;
            resourcePrediction.storage_gb_required += teamResourceUsage.storage;
            resourcePrediction.estimated_cost += teamResourceUsage.cost;
        }
        
        return resourcePrediction;
    }
    
    getTeamResourceUsage(teamName) {
        // Configuración de recursos por tipo de equipo
        const resourceMap = {
            'research-team': { cpu: 2, memory: 4, network: 10, storage: 1, cost: 5 },
            'marketing-team': { cpu: 1, memory: 2, network: 5, storage: 0.5, cost: 3 },
            'design-creative-team': { cpu: 4, memory: 8, network: 20, storage: 5, cost: 10 },
            'image-search-team': { cpu: 2, memory: 4, network: 50, storage: 2, cost: 8 },
            'finance-team': { cpu: 1, memory: 2, network: 2, storage: 0.1, cost: 2 },
            'legal-team': { cpu: 1, memory: 1, network: 1, storage: 0.1, cost: 1 },
            'default': { cpu: 1, memory: 2, network: 5, storage: 1, cost: 3 }
        };
        
        return resourceMap[teamName] || resourceMap.default;
    }
    
    async predictWorkflowPerformance(workflow, parameters) {
        this.stats.performance_predictions++;
        
        // Simulación de predicción de performance
        const baseTime = workflow.estimated_duration || 3600000; // 1 hora por defecto
        const complexity = workflow.steps.length;
        const teamDiversity = new Set(workflow.teams).size;
        
        const prediction = {
            estimated_total_time: baseTime,
            confidence_score: 0.85,
            bottlenecks: [],
            optimization_opportunities: [],
            resource_scaling_recommendations: [],
            risk_factors: []
        };
        
        // Factores que afectan el performance
        if (teamDiversity > 5) {
            prediction.bottlenecks.push('High team diversity may cause coordination overhead');
        }
        
        if (complexity > 10) {
            prediction.risk_factors.push('High workflow complexity increases failure probability');
        }
        
        // Sugerencias de optimización
        prediction.optimization_opportunities = this.generatePerformanceOptimizationSuggestions(workflow);
        
        return prediction;
    }
    
    generatePerformanceOptimizationSuggestions(workflow) {
        const suggestions = [];
        
        if (workflow.steps.filter(step => step.parallel === false).length > 3) {
            suggestions.push({
                type: 'parallelization',
                description: 'Consider making more steps parallel to reduce total execution time',
                impact: 'high',
                effort: 'medium'
            });
        }
        
        if (workflow.teams.length > 5) {
            suggestions.push({
                type: 'resource_pooling',
                description: 'Group similar teams to improve resource utilization',
                impact: 'medium',
                effort: 'low'
            });
        }
        
        return suggestions;
    }
    
    generateOptimizationSuggestions(workflow, optimization_level) {
        const suggestions = [];
        
        if (optimization_level === 'aggressive') {
            suggestions.push({
                type: 'aggressive_parallelization',
                description: 'Maximize parallel execution of independent steps',
                estimated_improvement: '30-50% time reduction',
                risk_level: 'medium'
            });
        }
        
        if (workflow.optimization_rules) {
            for (const rule of workflow.optimization_rules) {
                suggestions.push({
                    type: rule.type,
                    description: `Apply optimization rule: ${rule.type}`,
                    target: rule.target || rule.teams,
                    impact: 'high'
                });
            }
        }
        
        return suggestions;
    }
    
    calculateTimeEstimations(workflow) {
        const estimations = {
            optimistic: 0,
            most_likely: 0,
            pessimistic: 0,
            phases: []
        };
        
        let totalOptimistic = 0;
        let totalMostLikely = 0;
        let totalPessimistic = 0;
        
        for (const step of workflow.steps) {
            const baseDuration = step.estimated_duration || 300000; // 5 minutos por defecto
            const optimistic = baseDuration * 0.8;  // 20% menos tiempo
            const mostLikely = baseDuration;
            const pessimistic = baseDuration * 1.5;  // 50% más tiempo
            
            estimations.phases.push({
                step_id: step.id,
                step_name: step.name,
                optimistic,
                most_likely,
                pessimistic
            });
            
            totalOptimistic += optimistic;
            totalMostLikely += mostLikely;
            totalPessimistic += pessimistic;
        }
        
        estimations.optimistic = totalOptimistic;
        estimations.most_likely = totalMostLikely;
        estimations.pessimistic = totalPessimistic;
        
        return estimations;
    }
    
    validatePlan(workflow, constraints) {
        const validations = {
            valid: true,
            warnings: [],
            errors: [],
            constraints_check: {}
        };
        
        // Verificar constraints
        for (const [constraint, value] of Object.entries(constraints)) {
            switch (constraint) {
                case 'max_duration':
                    const totalDuration = workflow.estimated_duration || 3600000;
                    if (totalDuration > value) {
                        validations.warnings.push(`Workflow duration (${totalDuration}ms) exceeds constraint (${value}ms)`);
                    }
                    break;
                    
                case 'required_teams':
                    const missingTeams = value.filter(team => !workflow.teams.includes(team));
                    if (missingTeams.length > 0) {
                        validations.errors.push(`Missing required teams: ${missingTeams.join(', ')}`);
                        validations.valid = false;
                    }
                    break;
                    
                case 'priority':
                    if (workflow.priority !== value) {
                        validations.warnings.push(`Workflow priority (${workflow.priority}) does not match constraint (${value})`);
                    }
                    break;
            }
            
            validations.constraints_check[constraint] = value;
        }
        
        return validations;
    }
    
    async optimizeWorkflow(workflowId, currentExecutionData, optimizationGoals) {
        const startTime = Date.now();
        this.stats.workflows_optimized++;
        
        this.logger.info(`Optimizing workflow: ${workflowId}`, { optimizationGoals });
        
        try {
            const workflow = this.workflowDefinitions.get(workflowId);
            if (!workflow) {
                throw new Error(`Workflow ${workflowId} not found`);
            }
            
            const optimization = {
                workflow_id: workflowId,
                optimization_timestamp: new Date().toISOString(),
                goals: optimizationGoals,
                
                // Análisis de performance actual
                current_performance: this.analyzeCurrentPerformance(currentExecutionData),
                
                // Optimizaciones aplicadas
                optimizations_applied: this.applyOptimizations(workflow, optimizationGoals),
                
                // Nuevas métricas esperadas
                expected_improvements: this.calculateExpectedImprovements(workflow, optimizationGoals),
                
                // Riesgos de optimización
                optimization_risks: this.assessOptimizationRisks(workflow, optimizationGoals),
                
                // Recomendaciones de implementación
                implementation_recommendations: this.generateImplementationRecommendations(optimizationGoals)
            };
            
            const duration = Date.now() - startTime;
            this.stats.avg_optimization_time = ((this.stats.avg_optimization_time * (this.stats.workflows_optimized - 1)) + duration) / this.stats.workflows_optimized;
            
            this.logger.info(`Workflow optimization completed: ${workflowId}`, { duration });
            
            return optimization;
            
        } catch (error) {
            this.logger.error(`Workflow optimization failed: ${workflowId}`, { error: error.message });
            throw error;
        }
    }
    
    analyzeCurrentPerformance(executionData) {
        // Simulación de análisis de performance actual
        return {
            avg_execution_time: executionData.avg_time || 3600000,
            success_rate: executionData.success_rate || 0.95,
            resource_utilization: executionData.resource_util || 0.7,
            bottlenecks: executionData.bottlenecks || [],
            cost_per_execution: executionData.cost || 100
        };
    }
    
    applyOptimizations(workflow, goals) {
        const optimizations = [];
        
        if (goals.time_reduction) {
            optimizations.push({
                type: 'parallelization',
                description: 'Increase parallel execution of independent steps',
                expected_time_reduction: goals.time_reduction
            });
        }
        
        if (goals.cost_reduction) {
            optimizations.push({
                type: 'resource_optimization',
                description: 'Optimize resource allocation across teams',
                expected_cost_reduction: goals.cost_reduction
            });
        }
        
        if (goals.quality_improvement) {
            optimizations.push({
                type: 'quality_enhancement',
                description: 'Add additional QA steps and validation',
                expected_quality_improvement: goals.quality_improvement
            });
        }
        
        return optimizations;
    }
    
    calculateExpectedImprovements(workflow, goals) {
        const improvements = {
            time_reduction: 0,
            cost_reduction: 0,
            quality_improvement: 0,
            resource_efficiency: 0
        };
        
        if (goals.time_reduction) {
            improvements.time_reduction = Math.min(goals.time_reduction, 50); // Máximo 50%
        }
        
        if (goals.cost_reduction) {
            improvements.cost_reduction = Math.min(goals.cost_reduction, 30); // Máximo 30%
        }
        
        if (goals.quality_improvement) {
            improvements.quality_improvement = Math.min(goals.quality_improvement, 25); // Máximo 25%
        }
        
        return improvements;
    }
    
    assessOptimizationRisks(workflow, goals) {
        const risks = [];
        
        if (goals.time_reduction > 30) {
            risks.push({
                type: 'time_rush',
                description: 'Aggressive time reduction may compromise quality',
                severity: 'medium',
                mitigation: 'Implement robust testing and validation'
            });
        }
        
        if (goals.cost_reduction > 25) {
            risks.push({
                type: 'resource_cuts',
                description: 'Significant cost reduction may affect team performance',
                severity: 'high',
                mitigation: 'Monitor team performance closely'
            });
        }
        
        return risks;
    }
    
    generateImplementationRecommendations(goals) {
        const recommendations = [];
        
        recommendations.push({
            phase: 'preparation',
            actions: [
                'Backup current workflow configuration',
                'Set up monitoring for performance metrics',
                'Prepare rollback procedures'
            ]
        });
        
        recommendations.push({
            phase: 'implementation',
            actions: [
                'Apply optimizations gradually',
                'Monitor performance in real-time',
                'Validate outputs at each step'
            ]
        });
        
        recommendations.push({
            phase: 'validation',
            actions: [
                'Compare actual vs expected improvements',
                'Fine-tune optimizations based on results',
                'Document lessons learned'
            ]
        });
        
        return recommendations;
    }
    
    async analyzeDependencies(steps, constraints = {}) {
        const analysis = {
            steps_analyzed: steps.length,
            dependency_chains: [],
            parallel_opportunities: [],
            sequential_requirements: [],
            optimization_suggestions: []
        };
        
        // Analizar cadenas de dependencias
        const chains = this.findDependencyChains(steps);
        analysis.dependency_chains = chains;
        
        // Identificar oportunidades de paralelización
        analysis.parallel_opportunities = this.findParallelOpportunities(steps);
        
        // Identificar requerimientos secuenciales
        analysis.sequential_requirements = this.findSequentialRequirements(steps);
        
        // Generar sugerencias de optimización
        analysis.optimization_suggestions = this.generateDependencyOptimizationSuggestions(chains);
        
        this.stats.dependencies_resolved += steps.length;
        
        return analysis;
    }
    
    findDependencyChains(steps) {
        const chains = [];
        const stepMap = new Map(steps.map(step => [step.id, step]));
        
        for (const step of steps) {
            if (!step.dependencies || step.dependencies.length === 0) {
                // Inicio de una cadena
                const chain = this.buildDependencyChain(step, stepMap);
                if (chain.length > 1) {
                    chains.push(chain);
                }
            }
        }
        
        return chains;
    }
    
    buildDependencyChain(step, stepMap, visited = new Set()) {
        if (visited.has(step.id)) {
            return [step]; // Evitar ciclos
        }
        
        visited.add(step.id);
        const chain = [step];
        
        if (step.dependencies) {
            for (const depId of step.dependencies) {
                const depStep = stepMap.get(depId);
                if (depStep) {
                    const depChain = this.buildDependencyChain(depStep, stepMap, new Set(visited));
                    chain.unshift(...depChain);
                }
            }
        }
        
        return chain;
    }
    
    findParallelOpportunities(steps) {
        const opportunities = [];
        
        for (const step of steps) {
            if (step.dependencies && step.dependencies.length > 0) {
                const hasDirectSiblings = steps.some(other => 
                    other.id !== step.id &&
                    other.dependencies &&
                    other.dependencies.length === step.dependencies.length &&
                    other.dependencies.every(dep => step.dependencies.includes(dep))
                );
                
                if (hasDirectSiblings) {
                    opportunities.push({
                        step_id: step.id,
                        step_name: step.name,
                        can_parallelize_with: steps
                            .filter(other => 
                                other.id !== step.id &&
                                other.dependencies &&
                                other.dependencies.length === step.dependencies.length &&
                                other.dependencies.every(dep => step.dependencies.includes(dep))
                            )
                            .map(s => s.id)
                    });
                }
            }
        }
        
        return opportunities;
    }
    
    findSequentialRequirements(steps) {
        return steps
            .filter(step => step.dependencies && step.dependencies.length > 0)
            .map(step => ({
                step_id: step.id,
                step_name: step.name,
                depends_on: step.dependencies,
                blocking_factors: step.dependencies.length
            }));
    }
    
    generateDependencyOptimizationSuggestions(chains) {
        const suggestions = [];
        
        for (const chain of chains) {
            if (chain.length > 3) {
                suggestions.push({
                    type: 'chain_break',
                    description: `Long dependency chain detected (${chain.length} steps)`,
                    suggestion: 'Consider breaking the chain with intermediate results or parallel processing',
                    impact: 'high'
                });
            }
        }
        
        return suggestions;
    }
    
    async predictPerformance(workflow_id, parameters, historical_data) {
        this.stats.performance_predictions++;
        
        const workflow = this.workflowDefinitions.get(workflow_id);
        if (!workflow) {
            throw new Error(`Workflow ${workflow_id} not found`);
        }
        
        const prediction = {
            workflow_id,
            prediction_timestamp: new Date().toISOString(),
            base_estimates: this.calculateBaseEstimates(workflow),
            performance_factors: this.analyzePerformanceFactors(workflow, parameters),
            risk_assessment: this.assessPerformanceRisks(workflow, historical_data),
            confidence_metrics: this.calculateConfidenceMetrics(historical_data)
        };
        
        return prediction;
    }
    
    calculateBaseEstimates(workflow) {
        const totalSteps = workflow.steps.length;
        const avgStepTime = workflow.estimated_duration / totalSteps;
        
        return {
            total_steps: totalSteps,
            avg_step_duration: avgStepTime,
            estimated_total_time: workflow.estimated_duration,
            parallel_execution_savings: this.calculateParallelSavings(workflow.steps),
            resource_requirements: this.calculateResourceRequirements(workflow.teams)
        };
    }
    
    calculateParallelSavings(steps) {
        const parallelSteps = steps.filter(step => step.parallel).length;
        const sequentialSteps = steps.length - parallelSteps;
        const maxParallelTime = Math.max(...steps.map(step => step.estimated_duration));
        const totalSequentialTime = steps
            .filter(step => !step.parallel)
            .reduce((sum, step) => sum + step.estimated_duration, 0);
        
        return {
            potential_savings: totalSequentialTime - maxParallelTime,
            efficiency_gain: ((totalSequentialTime - maxParallelTime) / totalSequentialTime) * 100
        };
    }
    
    calculateResourceRequirements(teams) {
        const uniqueTeams = [...new Set(teams)];
        return {
            teams_required: uniqueTeams.length,
            estimated_cost: uniqueTeams.length * 10, // Costo base por equipo
            resource_intensity: this.calculateResourceIntensity(uniqueTeams)
        };
    }
    
    calculateResourceIntensity(teams) {
        const intensityMap = {
            'research-team': 'high',
            'design-creative-team': 'high',
            'marketing-team': 'medium',
            'finance-team': 'low',
            'legal-team': 'low'
        };
        
        const intensities = teams.map(team => intensityMap[team] || 'medium');
        const highIntensity = intensities.filter(i => i === 'high').length;
        const mediumIntensity = intensities.filter(i => i === 'medium').length;
        
        return {
            high_intensity_teams: highIntensity,
            medium_intensity_teams: mediumIntensity,
            overall_intensity: highIntensity > teams.length / 2 ? 'high' : 'medium'
        };
    }
    
    analyzePerformanceFactors(workflow, parameters) {
        return {
            complexity_score: this.calculateComplexityScore(workflow),
            collaboration_overhead: this.calculateCollaborationOverhead(workflow.teams),
            dependency_depth: this.calculateDependencyDepth(workflow.steps),
            resource_contention: this.assessResourceContention(workflow.teams)
        };
    }
    
    calculateComplexityScore(workflow) {
        const factors = {
            step_count: workflow.steps.length / 10, // Normalizado
            team_diversity: [...new Set(workflow.teams)].length / 10,
            dependency_complexity: this.calculateDependencyComplexity(workflow.steps)
        };
        
        return Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    }
    
    calculateDependencyComplexity(steps) {
        const totalDependencies = steps.reduce((sum, step) => sum + (step.dependencies?.length || 0), 0);
        return totalDependencies / steps.length;
    }
    
    calculateCollaborationOverhead(teams) {
        const uniqueTeams = [...new Set(teams)];
        const crossTeamInteractions = uniqueTeams.length * 0.1; // Estimación
        return Math.min(crossTeamInteractions, 0.3); // Máximo 30% overhead
    }
    
    calculateDependencyDepth(steps) {
        // Encontrar la ruta de dependencias más larga
        let maxDepth = 0;
        for (const step of steps) {
            const depth = this.calculateStepDepth(step, steps, new Set());
            maxDepth = Math.max(maxDepth, depth);
        }
        return maxDepth;
    }
    
    calculateStepDepth(step, allSteps, visited) {
        if (visited.has(step.id)) return 0;
        visited.add(step.id);
        
        if (!step.dependencies || step.dependencies.length === 0) {
            return 1;
        }
        
        let maxDepDepth = 0;
        for (const depId of step.dependencies) {
            const depStep = allSteps.find(s => s.id === depId);
            if (depStep) {
                const depDepth = this.calculateStepDepth(depStep, allSteps, new Set(visited));
                maxDepDepth = Math.max(maxDepDepth, depDepth);
            }
        }
        
        return 1 + maxDepDepth;
    }
    
    assessResourceContention(teams) {
        const teamCounts = teams.reduce((counts, team) => {
            counts[team] = (counts[team] || 0) + 1;
            return counts;
        }, {});
        
        const highUsageTeams = Object.values(teamCounts).filter(count => count > 1);
        const contentionScore = highUsageTeams.length / teams.length;
        
        return {
            contention_score,
            high_usage_teams: highUsageTeams.length,
            recommended_scaling: contentionScore > 0.3 ? 'horizontal' : 'none'
        };
    }
    
    assessPerformanceRisks(workflow, historical_data) {
        const risks = [];
        
        if (workflow.steps.length > 10) {
            risks.push({
                type: 'complexity_risk',
                description: 'High number of steps increases failure probability',
                probability: 0.2,
                impact: 'medium',
                mitigation: 'Implement comprehensive error handling and rollback'
            });
        }
        
        if (new Set(workflow.teams).size > 6) {
            risks.push({
                type: 'coordination_risk',
                description: 'Large number of teams may cause coordination issues',
                probability: 0.3,
                impact: 'high',
                mitigation: 'Increase communication frequency and use orchestrator'
            });
        }
        
        return risks;
    }
    
    calculateConfidenceMetrics(historical_data) {
        const dataPoints = historical_data.data_points || 100;
        const accuracy = Math.min(0.95, dataPoints / 1000); // 95% max confidence
        const precision = historical_data.precision || 0.8;
        
        return {
            confidence_level: accuracy,
            precision_score: precision,
            reliability_score: (accuracy + precision) / 2,
            sample_size: dataPoints
        };
    }
    
    startOptimizationLoop() {
        setInterval(() => {
            this.stats.optimization_cycles++;
            
            // Limpiar cache viejo
            this.cleanupOldCache();
            
            // Actualizar métricas de performance
            this.updatePerformanceMetrics();
            
        }, this.config.optimizationInterval);
    }
    
    cleanupOldCache() {
        const maxAge = 3600000; // 1 hora
        const now = Date.now();
        
        for (const [key, value] of this.workflowCache) {
            if (now - value.cached_at > maxAge) {
                this.workflowCache.delete(key);
            }
        }
    }
    
    updatePerformanceMetrics() {
        this.stats.uptime = Date.now() - this.stats.startTime;
        
        // Guardar métricas en Redis
        if (this.redis) {
            this.redis.setex('planner:metrics', 300, JSON.stringify({
                stats: this.stats,
                cache_size: this.workflowCache.size,
                workflows_loaded: this.workflowDefinitions.size,
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    startPerformanceMonitoring() {
        setInterval(() => {
            // Monitorear uso de memoria y CPU
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
                this.logger.warn('High memory usage detected, triggering cache cleanup');
                this.cleanupOldCache();
            }
            
        }, 60000); // Cada minuto
    }
    
    async start() {
        try {
            this.server = http.createServer(this.app);
            
            const port = process.env.PLANNER_PORT || 8025;
            const host = process.env.PLANNER_HOST || '0.0.0.0';
            
            this.server.listen(port, host, () => {
                this.logger.info(`Silhouette Planner V4.0.0 started`, {
                    port,
                    host,
                    workers: this.config.workers,
                    workflows_loaded: this.workflowDefinitions.size
                });
            });
            
        } catch (error) {
            this.logger.error('Failed to start planner:', error);
            process.exit(1);
        }
    }
}

// Iniciar el planner si este archivo se ejecuta directamente
if (require.main === module) {
    const planner = new SilhouettePlanner();
    planner.start();
}

module.exports = SilhouettePlanner;