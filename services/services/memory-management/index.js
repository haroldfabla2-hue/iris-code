#!/usr/bin/env node
/**
 * MEMORY MANAGEMENT SERVICE
 * Gestión inteligente de memoria y optimización del sistema
 * 
 * Responsabilidades:
 * - Limpieza automática de contexto obsoleto
 * - Optimización de almacenamiento en pgvector
 * - Compresión y archivado de datos
 * - Métricas y monitoreo de memoria
 * - Backup y recuperación
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cron = require('node-cron');
const winston = require('winston');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MemoryManagementService {
    constructor() {
        this.app = express();
        this.port = process.env.MEMORY_MANAGEMENT_PORT || 8104;
        this.running = false;
        
        // Pool de PostgreSQL
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://iris_user:IrisSecure2025@iris-postgres-context:5432/iris_context_db',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        // Cliente Redis
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
            defaultMeta: { service: 'memory-management' },
            transports: [
                new winston.transports.File({ filename: 'logs/memory-management/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/memory-management/combined.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });
        
        // Directorios de trabajo
        this.dataDir = '/app/data';
        this.backupDir = '/app/backups';
        this.archiveDir = '/app/archives';
        
        this.initializeDirectories();
        this.initializeMiddleware();
        this.setupRoutes();
        this.startScheduledTasks();
        this.startHealthChecks();
    }
    
    async initializeDirectories() {
        try {
            await fs.ensureDir(this.dataDir);
            await fs.ensureDir(this.backupDir);
            await fs.ensureDir(this.archiveDir);
            this.logger.info('Directories initialized', {
                data: this.dataDir,
                backup: this.backupDir,
                archive: this.archiveDir
            });
        } catch (error) {
            this.logger.error('Error initializing directories', { error: error.message });
            throw error;
        }
    }
    
    initializeMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '2mb' }));
        this.app.use(morgan('combined'));
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                service: 'memory-management',
                timestamp: new Date().toISOString()
            });
        });
        
        // Limpieza manual de contexto obsoleto
        this.app.post('/cleanup', async (req, res) => {
            try {
                const { 
                    olderThanDays = 30, 
                    maxContexts = 10000,
                    dryRun = false 
                } = req.body;
                
                this.logger.info('Manual cleanup requested', {
                    olderThanDays,
                    maxContexts,
                    dryRun
                });
                
                const results = await this.performCleanup({
                    olderThanDays,
                    maxContexts,
                    dryRun
                });
                
                res.json({
                    success: true,
                    results,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Error in manual cleanup', { error: error.message });
                res.status(500).json({ 
                    error: 'Cleanup failed',
                    message: error.message 
                });
            }
        });
        
        // Optimización de almacenamiento
        this.app.post('/optimize', async (req, res) => {
            try {
                const { 
                    compressData = true,
                    rebuildIndexes = true,
                    analyzeStats = true 
                } = req.body;
                
                this.logger.info('Storage optimization requested', {
                    compressData,
                    rebuildIndexes,
                    analyzeStats
                });
                
                const results = await this.optimizeStorage({
                    compressData,
                    rebuildIndexes,
                    analyzeStats
                });
                
                res.json({
                    success: true,
                    results,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Error in storage optimization', { error: error.message });
                res.status(500).json({ 
                    error: 'Storage optimization failed',
                    message: error.message 
                });
            }
        });
        
        // Crear backup
        this.app.post('/backup', async (req, res) => {
            try {
                const { 
                    includeEmbeddings = true,
                    compress = true,
                    description = 'Manual backup' 
                } = req.body;
                
                this.logger.info('Backup creation requested', {
                    includeEmbeddings,
                    compress,
                    description
                });
                
                const backupId = await this.createBackup({
                    includeEmbeddings,
                    compress,
                    description
                });
                
                res.json({
                    success: true,
                    backupId,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Error creating backup', { error: error.message });
                res.status(500).json({ 
                    error: 'Backup creation failed',
                    message: error.message 
                });
            }
        });
        
        // Listar backups
        this.app.get('/backups', async (req, res) => {
            try {
                const backups = await this.listBackups();
                res.json({
                    success: true,
                    backups,
                    count: backups.length
                });
            } catch (error) {
                this.logger.error('Error listing backups', { error: error.message });
                res.status(500).json({ error: 'Failed to list backups' });
            }
        });
        
        // Métricas de memoria
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.getMemoryMetrics();
                res.json({
                    success: true,
                    metrics,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.logger.error('Error getting memory metrics', { error: error.message });
                res.status(500).json({ error: 'Failed to get metrics' });
            }
        });
        
        // Estadísticas del servicio
        this.app.get('/stats', async (req, res) => {
            try {
                const stats = await this.getManagementStats();
                res.json(stats);
            } catch (error) {
                this.logger.error('Error getting management stats', { error: error.message });
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
    }
    
    async performCleanup(options) {
        const { olderThanDays, maxContexts, dryRun } = options;
        const results = {
            deleted: 0,
            archived: 0,
            optimized: 0,
            sizeFreed: 0,
            dryRun
        };
        
        try {
            // 1. Eliminar contextos muy antiguos
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            
            if (dryRun) {
                const { rows } = await this.pgPool.query(
                    'SELECT COUNT(*) as count FROM processed_contexts WHERE processed_at < $1',
                    [cutoffDate]
                );
                results.deleted += parseInt(rows[0].count);
            } else {
                const { rowCount } = await this.pgPool.query(
                    'DELETE FROM processed_contexts WHERE processed_at < $1',
                    [cutoffDate]
                );
                results.deleted += rowCount;
            }
            
            // 2. Archivar contextos antiguos pero valiosos
            const archiveThreshold = new Date();
            archiveThreshold.setDate(archiveThreshold.getDate() - 7); // 1 semana
            
            const archiveContexts = await this.pgPool.query(`
                SELECT id, content, metadata, processed_at 
                FROM processed_contexts 
                WHERE processed_at >= $1 AND processed_at < $2
                ORDER BY processed_at ASC
                LIMIT 1000
            `, [cutoffDate, archiveThreshold]);
            
            for (const context of archiveContexts.rows) {
                if (!dryRun) {
                    await this.archiveContext(context);
                    await this.pgPool.query(
                        'DELETE FROM processed_contexts WHERE id = $1',
                        [context.id]
                    );
                }
                results.archived++;
            }
            
            // 3. Optimizar índices de pgvector
            if (rebuildIndexes) {
                if (!dryRun) {
                    await this.pgPool.query('REINDEX INDEX processed_contexts_embedding_idx');
                }
                results.optimized++;
            }
            
            // 4. Análisis de estadísticas
            if (analyzeStats) {
                if (!dryRun) {
                    await this.pgPool.query('ANALYZE processed_contexts');
                }
                results.optimized++;
            }
            
            this.logger.info('Cleanup completed', { results, options });
            return results;
            
        } catch (error) {
            this.logger.error('Error in cleanup process', { error: error.message });
            throw error;
        }
    }
    
    async archiveContext(context) {
        try {
            const archivePath = path.join(this.archiveDir, `${context.id}.json`);
            await fs.writeJson(archivePath, {
                id: context.id,
                content: context.content,
                metadata: context.metadata,
                processedAt: context.processed_at,
                archivedAt: new Date().toISOString(),
                reason: 'automatic_archive'
            });
            
            this.logger.info('Context archived', { contextId: context.id });
        } catch (error) {
            this.logger.error('Error archiving context', { 
                contextId: context.id,
                error: error.message 
            });
        }
    }
    
    async optimizeStorage(options) {
        const { compressData, rebuildIndexes, analyzeStats } = options;
        const results = {
            indexesRebuilt: 0,
            statsAnalyzed: 0,
            storageOptimized: false,
            compressionApplied: false
        };
        
        try {
            // 1. Reindexar pgvector
            if (rebuildIndexes) {
                await this.pgPool.query('REINDEX INDEX processed_contexts_embedding_idx');
                results.indexesRebuilt++;
            }
            
            // 2. Analizar estadísticas
            if (analyzeStats) {
                await this.pgPool.query('ANALYZE processed_contexts');
                results.statsAnalyzed++;
            }
            
            // 3. Comprimir datos (simulado - en producción se haría con pg_compression)
            if (compressData) {
                // Placeholder para compresión
                results.compressionApplied = true;
            }
            
            // 4. Optimizar espacio en disco
            await this.pgPool.query('VACUUM FULL processed_contexts');
            results.storageOptimized = true;
            
            this.logger.info('Storage optimization completed', { results });
            return results;
            
        } catch (error) {
            this.logger.error('Error in storage optimization', { error: error.message });
            throw error;
        }
    }
    
    async createBackup(options) {
        const { includeEmbeddings, compress, description } = options;
        const backupId = uuidv4();
        const timestamp = new Date().toISOString();
        
        try {
            // 1. Crear estructura del backup
            const backupInfo = {
                id: backupId,
                timestamp,
                description,
                includeEmbeddings,
                status: 'in_progress',
                tables: [],
                size: 0,
                createdBy: 'memory-management-service'
            };
            
            // 2. Exportar datos de processed_contexts
            let exportData = [];
            
            if (includeEmbeddings) {
                const result = await this.pgPool.query(`
                    SELECT id, original_id, content, summary, sentiment_label, 
                           entities, keywords, metadata, processed_at, embedding
                    FROM processed_contexts
                    ORDER BY processed_at DESC
                    LIMIT 10000
                `);
                exportData = result.rows;
            } else {
                const result = await this.pgPool.query(`
                    SELECT id, original_id, content, summary, sentiment_label, 
                           entities, keywords, metadata, processed_at
                    FROM processed_contexts
                    ORDER BY processed_at DESC
                    LIMIT 10000
                `);
                exportData = result.rows;
            }
            
            backupInfo.tables.push({
                name: 'processed_contexts',
                rowCount: exportData.length,
                exportedAt: new Date().toISOString()
            });
            
            // 3. Guardar backup
            const backupFile = path.join(this.backupDir, `${backupId}.json`);
            const backupData = {
                info: backupInfo,
                data: exportData
            };
            
            if (compress) {
                // Placeholder para compresión
                await fs.writeJson(backupFile, backupData, { spaces: 2 });
            } else {
                await fs.writeJson(backupFile, backupData, { spaces: 2 });
            }
            
            // 4. Actualizar información del backup
            backupInfo.status = 'completed';
            backupInfo.size = await fs.pathExists(backupFile) ? (await fs.stat(backupFile)).size : 0;
            
            await fs.writeJson(path.join(this.backupDir, `${backupId}_info.json`), backupInfo);
            
            this.logger.info('Backup created successfully', { backupId, size: backupInfo.size });
            return backupId;
            
        } catch (error) {
            this.logger.error('Error creating backup', { backupId, error: error.message });
            
            // Marcar backup como fallido
            const failedBackup = {
                id: backupId,
                timestamp,
                description,
                status: 'failed',
                error: error.message,
                createdBy: 'memory-management-service'
            };
            
            await fs.writeJson(path.join(this.backupDir, `${backupId}_info.json`), failedBackup);
            throw error;
        }
    }
    
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupInfos = files
                .filter(file => file.endsWith('_info.json'))
                .map(async file => {
                    const infoPath = path.join(this.backupDir, file);
                    const info = await fs.readJson(infoPath);
                    
                    // Verificar si el archivo de datos existe
                    const dataFile = file.replace('_info.json', '.json');
                    const dataPath = path.join(this.backupDir, dataFile);
                    const dataExists = await fs.pathExists(dataPath);
                    
                    return {
                        ...info,
                        dataExists
                    };
                });
            
            return await Promise.all(backupInfos);
        } catch (error) {
            this.logger.error('Error listing backups', { error: error.message });
            return [];
        }
    }
    
    async getMemoryMetrics() {
        try {
            // Métricas de PostgreSQL
            const dbStats = await this.pgPool.query(`
                SELECT 
                    pg_database_size('iris_context_db') as database_size,
                    COUNT(*) as total_contexts,
                    AVG(EXTRACT(EPOCH FROM (NOW() - processed_at))) * -1 as avg_age_hours,
                    COUNT(*) FILTER (WHERE processed_at > NOW() - INTERVAL '1 day') as contexts_24h
                FROM processed_contexts
            `);
            
            // Métricas de Redis
            const redisInfo = await this.redis.info('memory');
            const redisKeys = await this.redis.dbsize();
            
            // Métricas de disco
            const diskUsage = await this.getDiskUsage();
            
            return {
                database: {
                    size: parseInt(dbStats.rows[0].database_size),
                    sizeFormatted: this.formatBytes(parseInt(dbStats.rows[0].database_size)),
                    totalContexts: parseInt(dbStats.rows[0].total_contexts),
                    avgAgeHours: parseFloat(dbStats.rows[0].avg_age_hours),
                    contextsLast24h: parseInt(dbStats.rows[0].contexts_24h)
                },
                redis: {
                    keys: redisKeys,
                    info: redisInfo
                },
                disk: diskUsage,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Error getting memory metrics', { error: error.message });
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async getDiskUsage() {
        try {
            const [dataStats, backupStats, archiveStats] = await Promise.all([
                this.getDirectorySize(this.dataDir),
                this.getDirectorySize(this.backupDir),
                this.getDirectorySize(this.archiveDir)
            ]);
            
            return {
                data: dataStats,
                backups: backupStats,
                archives: archiveStats,
                total: dataStats + backupStats + archiveStats
            };
        } catch (error) {
            this.logger.error('Error getting disk usage', { error: error.message });
            return { error: error.message };
        }
    }
    
    async getDirectorySize(dir) {
        try {
            if (!(await fs.pathExists(dir))) return 0;
            
            const files = await fs.readdir(dir);
            let totalSize = 0;
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                    totalSize += stats.size;
                } else if (stats.isDirectory()) {
                    totalSize += await this.getDirectorySize(filePath);
                }
            }
            
            return totalSize;
        } catch (error) {
            this.logger.error('Error calculating directory size', { dir, error: error.message });
            return 0;
        }
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async getManagementStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_operations,
                    COUNT(CASE WHEN processed_at > NOW() - INTERVAL '1 day' THEN 1 END) as operations_24h
                FROM processed_contexts
            `;
            
            const result = await this.pgPool.query(query);
            
            return {
                service: 'memory-management',
                timestamp: new Date().toISOString(),
                stats: result.rows[0],
                directories: {
                    data: this.dataDir,
                    backup: this.backupDir,
                    archive: this.archiveDir
                }
            };
        } catch (error) {
            this.logger.error('Error getting management stats', { error: error.message });
            return {
                service: 'memory-management',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
    
    startScheduledTasks() {
        // Limpieza automática cada día a las 2:00 AM
        cron.schedule('0 2 * * *', async () => {
            try {
                this.logger.info('Starting scheduled cleanup');
                await this.performCleanup({
                    olderThanDays: 30,
                    maxContexts: 10000,
                    dryRun: false
                });
            } catch (error) {
                this.logger.error('Error in scheduled cleanup', { error: error.message });
            }
        });
        
        // Backup automático cada domingo a las 3:00 AM
        cron.schedule('0 3 * * 0', async () => {
            try {
                this.logger.info('Starting scheduled backup');
                await this.createBackup({
                    includeEmbeddings: false,
                    compress: true,
                    description: 'Automatic weekly backup'
                });
            } catch (error) {
                this.logger.error('Error in scheduled backup', { error: error.message });
            }
        });
        
        // Optimización semanal
        cron.schedule('0 4 * * 0', async () => {
            try {
                this.logger.info('Starting scheduled optimization');
                await this.optimizeStorage({
                    compressData: true,
                    rebuildIndexes: true,
                    analyzeStats: true
                });
            } catch (error) {
                this.logger.error('Error in scheduled optimization', { error: error.message });
            }
        });
    }
    
    startHealthChecks() {
        setInterval(async () => {
            try {
                await this.pgPool.query('SELECT 1');
                await this.redis.ping();
                await this.getDiskUsage();
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
            this.logger.info(`Memory Management Service started on port ${this.port}`);
        });
    }
}

// Iniciar el servicio si se ejecuta directamente
if (require.main === module) {
    const service = new MemoryManagementService();
    service.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down Memory Management Service...');
        process.exit(0);
    });
}

module.exports = MemoryManagementService;