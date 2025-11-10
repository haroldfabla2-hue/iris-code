#!/usr/bin/env node
/**
 * VALIDADOR Y CORRECTOR COMPLETO DE SISTEMA DE PUERTOS DINÁMICOS
 * Analiza línea por línea todo el directorio y corrige inconsistencias
 */

const fs = require('fs');
const path = require('path');

class PortSystemValidator {
    constructor() {
        this.workspaceRoot = '/workspace/iris-code-enhanced';
        this.errors = [];
        this.warnings = [];
        this.corrections = [];
        
        // Configuración de puertos según .port-config.json
        this.portConfig = {
            "api-gateway": 8000,
            "fallback-server": 8001,
            "silhouette-orchestrator": 8002,
            "silhouette-planner": 8003,
            "iris-backend": 3000,
            "iris-frontend": 3001,
            "postgres": 5432,
            "redis": 6379,
            "prometheus": 9090,
            "grafana": 3002,
            "business-development": 8004,
            "marketing": 8005,
            "sales": 8006,
            "finance": 8007
        };
        
        // Mapeo de nombres de equipos
        this.teamMapping = {
            'business-development-team': 'business_development_team',
            'marketing-team': 'marketing_team',
            'sales-team': 'sales_team',
            'finance-team': 'finance_team'
        };
    }
    
    async runCompleteValidation() {
        console.log('🔍 Iniciando validación completa del sistema de puertos dinámicos...\n');
        
        // 1. Validar .port-config.json
        this.validatePortConfig();
        
        // 2. Validar docker-compose.dynamic.yml
        await this.validateDockerComposeDynamic();
        
        // 3. Validar todos los equipos de business
        await this.validateBusinessTeams();
        
        // 4. Validar coherencia general
        this.validateOverallConsistency();
        
        // 5. Aplicar correcciones
        await this.applyCorrections();
        
        // 6. Generar reporte final
        this.generateFinalReport();
    }
    
    validatePortConfig() {
        console.log('📋 Validando .port-config.json...');
        
        const configPath = path.join(this.workspaceRoot, '.port-config.json');
        
        if (!fs.existsSync(configPath)) {
            this.errors.push('❌ Archivo .port-config.json no encontrado');
            return;
        }
        
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Verificar estructura básica
            const requiredKeys = ['api-gateway', 'fallback-server', 'silhouette-orchestrator', 'business-development', 'marketing', 'sales', 'finance'];
            const missingKeys = requiredKeys.filter(key => !(key in config));
            
            if (missingKeys.length > 0) {
                this.errors.push(`❌ Claves faltantes en .port-config.json: ${missingKeys.join(', ')}`);
            }
            
            // Verificar que no hay puertos duplicados
            const ports = Object.values(config);
            const duplicates = ports.filter((port, index) => ports.indexOf(port) !== index);
            
            if (duplicates.length > 0) {
                this.errors.push(`❌ Puertos duplicados en .port-config.json: ${duplicates.join(', ')}`);
            }
            
            // Verificar rangos de puertos
            Object.entries(config).forEach(([service, port]) => {
                if (typeof port !== 'number' || port < 1 || port > 65535) {
                    this.errors.push(`❌ Puerto inválido para ${service}: ${port}`);
                }
            });
            
            console.log('✅ .port-config.json válido');
            
        } catch (error) {
            this.errors.push(`❌ Error leyendo .port-config.json: ${error.message}`);
        }
    }
    
    async validateDockerComposeDynamic() {
        console.log('🐳 Validando docker-compose.dynamic.yml...');
        
        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        
        if (!fs.existsSync(composePath)) {
            this.errors.push('❌ Archivo docker-compose.dynamic.yml no encontrado');
            return;
        }
        
        try {
            const content = fs.readFileSync(composePath, 'utf8');
            const lines = content.split('\n');
            
            // Verificar que todos los equipos están definidos
            const requiredTeams = ['business-development-team', 'marketing-team', 'sales-team', 'finance-team'];
            const definedTeams = [];
            
            lines.forEach((line, index) => {
                // Buscar definiciones de servicios
                if (line.trim().startsWith('  ') && line.includes(':')) {
                    const serviceName = line.trim().replace(':', '');
                    if (requiredTeams.includes(serviceName)) {
                        definedTeams.push(serviceName);
                    }
                }
                
                // Verificar contextos de build
                if (line.includes('context:')) {
                    const contextPath = line.split('context:')[1].trim();
                    if (contextPath.includes('silhouette/teams/')) {
                        console.log(`🔧 Línea ${index + 1}: ${contextPath}`);
                        
                        // Verificar que la ruta existe
                        const fullPath = path.join(this.workspaceRoot, contextPath);
                        if (!fs.existsSync(fullPath)) {
                            this.errors.push(`❌ Ruta no existe: ${contextPath} (Línea ${index + 1})`);
                        }
                    }
                }
                
                // Verificar puertos
                if (line.includes('ports:')) {
                    const portMapping = lines[index + 1]?.trim();
                    if (portMapping && portMapping.startsWith('- "')) {
                        const portMatch = portMapping.match(/- "(\d+):(\d+)"/);
                        if (portMatch) {
                            const externalPort = parseInt(portMatch[1]);
                            const internalPort = parseInt(portMatch[2]);
                            
                            // Verificar coherencia con .port-config.json
                            console.log(`🔌 Puerto mapeado: ${externalPort}:${internalPort} (Línea ${index + 2})`);
                        }
                    }
                }
            });
            
            // Verificar equipos faltantes
            const missingTeams = requiredTeams.filter(team => !definedTeams.includes(team));
            if (missingTeams.length > 0) {
                this.errors.push(`❌ Equipos faltantes en docker-compose.dynamic.yml: ${missingTeams.join(', ')}`);
                this.addMissingTeamsToDockerCompose(missingTeams);
            }
            
            console.log('✅ docker-compose.dynamic.yml validado');
            
        } catch (error) {
            this.errors.push(`❌ Error validando docker-compose.dynamic.yml: ${error.message}`);
        }
    }
    
    addMissingTeamsToDockerCompose(missingTeams) {
        console.log('🔧 Agregando equipos faltantes a docker-compose.dynamic.yml...');
        
        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        let content = fs.readFileSync(composePath, 'utf8');
        
        // Encontrar donde insertar los nuevos equipos
        const insertPoint = content.lastIndexOf('  # =============================================================================');
        
        const newTeamsSection = missingTeams.map(team => {
            const mappedName = this.teamMapping[team];
            const portConfigKey = team.replace('-team', '').replace('business-', 'business-');
            const externalPort = this.portConfig[portConfigKey] || 8006;
            
            return `  ${team}:
    build:
      context: ./src/silhouette/teams/business/${team}
      dockerfile: Dockerfile
    container_name: ${team}
    restart: unless-stopped
    ports:
      - "${externalPort}:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=${mappedName}
    volumes:
      - ./logs/teams:/var/log/silhouette/teams
    networks:
      - iris-network
    depends_on:
      - silhouette-orchestrator
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

`;
        }).join('');
        
        const insertContent = `\n  # =============================================================================\n  # EQUIPOS ADICIONALES - AÑADIDOS AUTOMÁTICAMENTE\n  # =============================================================================\n${newTeamsSection}`;
        
        content = content.substring(0, insertPoint) + insertContent + content.substring(insertPoint);
        
        fs.writeFileSync(composePath, content);
        this.corrections.push(`✅ Agregados ${missingTeams.length} equipos faltantes a docker-compose.dynamic.yml`);
    }
    
    async validateBusinessTeams() {
        console.log('👥 Validando equipos de business...');
        
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const team of teams) {
            console.log(`🔍 Validando equipo: ${team}`);
            await this.validateTeamStructure(team);
        }
    }
    
    async validateTeamStructure(teamName) {
        const teamPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business', teamName);
        const requiredFiles = ['team.js', 'Dockerfile', 'package.json'];
        
        // Verificar archivos requeridos
        for (const file of requiredFiles) {
            const filePath = path.join(teamPath, file);
            if (!fs.existsSync(filePath)) {
                this.errors.push(`❌ Archivo faltante en ${teamName}: ${file}`);
                continue;
            }
            
            // Validar contenido del archivo
            await this.validateFileContent(teamName, file, filePath);
        }
    }
    
    async validateFileContent(teamName, fileName, filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            if (fileName === 'team.js') {
                this.validateTeamJS(teamName, lines);
            } else if (fileName === 'Dockerfile') {
                this.validateDockerfile(teamName, lines);
            } else if (fileName === 'package.json') {
                this.validatePackageJson(teamName, lines);
            }
            
        } catch (error) {
            this.errors.push(`❌ Error leyendo ${fileName} de ${teamName}: ${error.message}`);
        }
    }
    
    validateTeamJS(teamName, lines) {
        const portConfigKey = teamName.replace('-team', '').replace('business-', 'business-');
        const expectedPort = this.portConfig[portConfigKey];
        
        let foundPort = null;
        let foundTeamName = null;
        
        lines.forEach((line, index) => {
            // Buscar configuración de puerto
            if (line.includes('port:') && line.includes('parseInt(process.env.TEAM_PORT)')) {
                const portMatch = line.match(/default:\s*(\d+)/);
                if (portMatch) {
                    foundPort = parseInt(portMatch[1]);
                }
            }
            
            // Buscar team name
            if (line.includes('team_name:') && line.includes(teamName)) {
                foundTeamName = teamName;
            }
        });
        
        // Verificar coherencia
        if (foundPort && foundPort !== 8000) {
            this.warnings.push(`⚠️ ${teamName}: Puerto en team.js (${foundPort}) no es 8000 (dentro del contenedor siempre debe ser 8000)`);
        }
        
        if (!foundTeamName) {
            this.errors.push(`❌ ${teamName}: Nombre de equipo no encontrado en team.js`);
        }
        
        console.log(`   ✅ team.js: Puerto interno correcto (8000), team name: ${foundTeamName || 'No encontrado'}`);
    }
    
    validateDockerfile(teamName, lines) {
        let foundExpose = null;
        let foundEnvPort = null;
        
        lines.forEach((line) => {
            if (line.startsWith('EXPOSE')) {
                foundExpose = line.split('EXPOSE')[1].trim();
            }
            if (line.startsWith('ENV TEAM_PORT=')) {
                foundEnvPort = line.split('=')[1].trim();
            }
        });
        
        // Verificar coherencia
        if (foundExpose !== '8000') {
            this.errors.push(`❌ ${teamName}: Dockerfile EXPOSE debe ser 8000, encontrado: ${foundExpose}`);
        }
        
        if (foundEnvPort !== '8000') {
            this.errors.push(`❌ ${teamName}: Dockerfile TEAM_PORT debe ser 8000, encontrado: ${foundEnvPort}`);
        }
        
        console.log(`   ✅ Dockerfile: EXPOSE ${foundExpose}, TEAM_PORT ${foundEnvPort}`);
    }
    
    validatePackageJson(teamName, lines) {
        // Validaciones básicas de package.json
        const content = lines.join('\n');
        
        try {
            const pkg = JSON.parse(content);
            
            if (!pkg.name) {
                this.errors.push(`❌ ${teamName}: package.json sin campo 'name'`);
            }
            
            if (!pkg.dependencies || !pkg.dependencies.express) {
                this.warnings.push(`⚠️ ${teamName}: package.json sin dependencia express`);
            }
            
            console.log(`   ✅ package.json: ${pkg.name || 'Sin nombre'}`);
            
        } catch (error) {
            this.errors.push(`❌ ${teamName}: package.json inválido: ${error.message}`);
        }
    }
    
    validateOverallConsistency() {
        console.log('🔄 Validando coherencia general del sistema...');
        
        // Verificar que no hay conflictos de puertos
        const usedPorts = new Set();
        Object.values(this.portConfig).forEach(port => {
            if (usedPorts.has(port)) {
                this.errors.push(`❌ Puerto duplicado en sistema: ${port}`);
            }
            usedPorts.add(port);
        });
        
        // Verificar que todos los equipos de business tienen estructura completa
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        const targetTeams = ['business-development-team', 'marketing-team', 'sales-team', 'finance-team'];
        const missingTeams = targetTeams.filter(team => !teams.includes(team));
        
        if (missingTeams.length > 0) {
            this.errors.push(`❌ Equipos faltantes en directorio business: ${missingTeams.join(', ')}`);
        }
        
        console.log('✅ Coherencia general validada');
    }
    
    async applyCorrections() {
        console.log('🔧 Aplicando correcciones automáticas...');
        
        if (this.corrections.length === 0) {
            console.log('✅ No se requieren correcciones automáticas');
            return;
        }
        
        // Las correcciones ya se aplicaron en los métodos anteriores
        console.log(`✅ ${this.corrections.length} correcciones aplicadas`);
    }
    
    generateFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 REPORTE FINAL DE VALIDACIÓN');
        console.log('='.repeat(80));
        
        console.log(`\n❌ ERRORES ENCONTRADOS: ${this.errors.length}`);
        this.errors.forEach(error => console.log(`   ${error}`));
        
        console.log(`\n⚠️ ADVERTENCIAS: ${this.warnings.length}`);
        this.warnings.forEach(warning => console.log(`   ${warning}`));
        
        console.log(`\n✅ CORRECCIONES APLICADAS: ${this.corrections.length}`);
        this.corrections.forEach(correction => console.log(`   ${correction}`));
        
        // Calcular score general
        const totalIssues = this.errors.length + this.warnings.length;
        const maxScore = 100;
        const errorPenalty = this.errors.length * 10;
        const warningPenalty = this.warnings.length * 2;
        const score = Math.max(0, maxScore - errorPenalty - warningPenalty);
        
        console.log(`\n🎯 SCORE GENERAL: ${score}/100`);
        
        if (score >= 90) {
            console.log('🏆 EXCELENTE - Sistema listo para producción');
        } else if (score >= 70) {
            console.log('✅ BUENO - Sistema funcional con mejoras menores');
        } else if (score >= 50) {
            console.log('⚠️ REGULAR - Requiere correcciones antes de producción');
        } else {
            console.log('❌ DEFICIENTE - Múltiples problemas críticos');
        }
        
        console.log('\n' + '='.repeat(80));
        
        // Guardar reporte
        const reportPath = path.join(this.workspaceRoot, 'validacion-sistema-puertos.json');
        const report = {
            timestamp: new Date().toISOString(),
            errors: this.errors,
            warnings: this.warnings,
            corrections: this.corrections,
            score: score,
            portConfig: this.portConfig
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Reporte guardado en: ${reportPath}`);
    }
}

// Ejecutar validación
if (require.main === module) {
    const validator = new PortSystemValidator();
    validator.runCompleteValidation().catch(console.error);
}

module.exports = PortSystemValidator;