#!/usr/bin/env node
/**
 * LIMPIEZA FINAL Y CORRECCIÓN COMPLETA
 * Elimina duplicados y corrige equipos existentes
 */

const fs = require('fs');
const path = require('path');

class FinalCleanup {
    constructor() {
        this.workspaceRoot = '/workspace/iris-code-enhanced';
        this.corrections = [];
    }
    
    async runFinalCleanup() {
        console.log('🧹 Iniciando limpieza final del sistema...\n');
        
        // 1. Limpiar docker-compose.dynamic.yml
        await this.cleanupDockerCompose();
        
        // 2. Corregir equipos existentes
        await this.fixExistingTeams();
        
        // 3. Generar reporte final
        this.generateFinalReport();
    }
    
    async cleanupDockerCompose() {
        console.log('🧹 Limpiando docker-compose.dynamic.yml...');
        
        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        let content = fs.readFileSync(composePath, 'utf8');
        
        // Remover secciones duplicadas de equipos
        const lines = content.split('\n');
        const cleanLines = [];
        let skipNext = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detectar duplicados y removerlos
            if (line.includes('marketing_team:') && !line.trim().startsWith('#')) {
                // Saltar toda la sección de marketing_team duplicada
                if (lines[i + 1]?.includes('build:')) {
                    // Contar líneas para saltar toda la sección
                    let sectionLines = 0;
                    let braceCount = 0;
                    for (let j = i; j < lines.length; j++) {
                        sectionLines++;
                        if (lines[j].includes('{')) braceCount++;
                        if (lines[j].includes('}')) braceCount--;
                        if (braceCount === 0 && sectionLines > 5) break;
                    }
                    i += sectionLines - 1;
                    this.corrections.push('✅ Removida sección duplicada de marketing_team');
                    continue;
                }
            }
            
            // Mantener línea
            cleanLines.push(line);
        }
        
        // Reescribir archivo limpio
        fs.writeFileSync(composePath, cleanLines.join('\n'));
        this.corrections.push('✅ Docker-compose.yml limpiado');
        
        // Regenerar con estructura correcta
        await this.regenerateDockerCompose();
    }
    
    async regenerateDockerCompose() {
        console.log('🔄 Regenerando docker-compose.dynamic.yml...');
        
        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        
        // Leer contenido actual
        let content = fs.readFileSync(composePath, 'utf8');
        
        // Definir equipos requeridos con su configuración correcta
        const requiredTeams = [
            {
                name: 'business-development-team',
                port: 8004,
                teamName: 'business_development_team',
                description: 'Business Development Team'
            },
            {
                name: 'marketing-team',
                port: 8005,
                teamName: 'marketing_team',
                description: 'Marketing Team'
            },
            {
                name: 'sales-team',
                port: 8006,
                teamName: 'sales_team',
                description: 'Sales Team'
            },
            {
                name: 'finance-team',
                port: 8007,
                teamName: 'finance_team',
                description: 'Finance Team'
            }
        ];
        
        // Buscar donde insertar los equipos (antes de postgres)
        const insertPoint = content.lastIndexOf('  # =============================================================================\n  # BASE DE DATOS POSTGRESQL');
        
        if (insertPoint !== -1) {
            const teamsSection = '\n  # =============================================================================\n  # EQUIPOS ESPECIALIZADOS - CORREGIDOS\n  # =============================================================================\n';
            
            const teamsDefinitions = requiredTeams.map(team => 
`  ${team.name}:
    build:
      context: ./src/silhouette/teams/business/${team.name}
      dockerfile: Dockerfile
    container_name: ${team.name}
    restart: unless-stopped
    ports:
      - "${team.port}:8000"
    environment:
      - TEAM_PORT=8000
      - TEAM_NAME=${team.teamName}
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

`).join('');
            
            content = content.substring(0, insertPoint) + teamsSection + teamsDefinitions + content.substring(insertPoint);
            fs.writeFileSync(composePath, content);
            this.corrections.push('✅ Regenerado docker-compose.yml con equipos correctos');
        }
    }
    
    async fixExistingTeams() {
        console.log('🔧 Corrigiendo equipos existentes...');
        
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const team of teams) {
            // Solo corregir equipos que necesitan arreglo
            if (!['business-development-team', 'marketing-team', 'sales-team', 'finance-team'].includes(team)) {
                await this.fixExistingTeam(team);
            }
        }
    }
    
    async fixExistingTeam(teamName) {
        console.log(`   🔧 Corrigiendo ${teamName}...`);
        
        const teamPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business', teamName);
        
        // Corregir Dockerfile
        const dockerfilePath = path.join(teamPath, 'Dockerfile');
        if (fs.existsSync(dockerfilePath)) {
            let dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
            
            // Asegurar TEAM_PORT=8000
            if (dockerfileContent.includes('TEAM_PORT')) {
                dockerfileContent = dockerfileContent.replace(/ENV\s+TEAM_PORT=[\w@]+/g, 'ENV TEAM_PORT=8000');
                this.corrections.push(`✅ TEAM_PORT corregido en ${teamName}/Dockerfile`);
            } else {
                // Agregar TEAM_PORT si no existe
                dockerfileContent = dockerfileContent.replace(
                    /# Variables de entorno por defecto/,
                    `# Variables de entorno por defecto
ENV TEAM_PORT=8000`
                );
                this.corrections.push(`✅ TEAM_PORT agregado en ${teamName}/Dockerfile`);
            }
            
            fs.writeFileSync(dockerfilePath, dockerfileContent);
        }
        
        // Corregir team.js
        const teamJsPath = path.join(teamPath, 'team.js');
        if (fs.existsSync(teamJsPath)) {
            let teamJsContent = fs.readFileSync(teamJsPath, 'utf8');
            
            // Mapeo de nombres
            const nameMap = {
                'cloud-services-team': 'cloud-services-team',
                'communications-team': 'communications-team',
                'customer-service-team': 'customer-service-team',
                'quality-assurance-team': 'quality-assurance-team',
                'support-team': 'support-team'
            };
            
            const correctName = nameMap[teamName] || teamName;
            
            // Agregar team_name si no existe
            if (!teamJsContent.includes('team_name:')) {
                const insertionPoint = teamJsContent.indexOf('// Configuración del equipo');
                if (insertionPoint !== -1) {
                    const newConfig = `        this.config = {
            team_name: '${correctName}',
            team_type: 'business',`;
                    
                    teamJsContent = teamJsContent.replace(
                        /this\.config = \{/,
                        newConfig
                    );
                    
                    fs.writeFileSync(teamJsPath, teamJsContent);
                    this.corrections.push(`✅ team_name agregado en ${teamName}/team.js`);
                }
            }
        }
    }
    
    generateFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🏁 REPORTE FINAL DE LIMPIEZA');
        console.log('='.repeat(80));
        
        console.log(`\n✅ CORRECCIONES APLICADAS: ${this.corrections.length}`);
        this.corrections.forEach(correction => console.log(`   ${correction}`));
        
        console.log('\n📋 RESUMEN DEL SISTEMA DE PUERTOS DINÁMICOS:');
        console.log('   🔌 Puertos asignados:');
        console.log('      • API Gateway: 8000:8020');
        console.log('      • Fallback Server: 8001:8021');
        console.log('      • Silhouette Orchestrator: 8002:8030');
        console.log('      • Silhouette Planner: 8003:8025');
        console.log('      • Business Development Team: 8004:8000');
        console.log('      • Marketing Team: 8005:8000');
        console.log('      • Sales Team: 8006:8000');
        console.log('      • Finance Team: 8007:8000');
        
        console.log('\n🎯 PRÓXIMOS PASOS:');
        console.log('   1. Ejecutar: docker-compose -f docker-compose.dynamic.yml up -d');
        console.log('   2. Verificar health checks: curl http://localhost:8004/health');
        console.log('   3. Probar integración: node verify-integration.js');
        
        console.log('\n' + '='.repeat(80));
        
        // Guardar reporte
        const reportPath = path.join(this.workspaceRoot, 'limpieza-final-completada.json');
        const report = {
            timestamp: new Date().toISOString(),
            corrections: this.corrections,
            totalCorrections: this.corrections.length,
            portConfig: {
                "api-gateway": "8000:8020",
                "fallback-server": "8001:8021", 
                "silhouette-orchestrator": "8002:8030",
                "silhouette-planner": "8003:8025",
                "business-development-team": "8004:8000",
                "marketing-team": "8005:8000",
                "sales-team": "8006:8000",
                "finance-team": "8007:8000"
            },
            status: 'completed'
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Reporte guardado en: ${reportPath}`);
    }
}

// Ejecutar limpieza final
if (require.main === module) {
    const cleanup = new FinalCleanup();
    cleanup.runFinalCleanup().catch(console.error);
}

module.exports = FinalCleanup;