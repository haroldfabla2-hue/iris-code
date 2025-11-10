#!/usr/bin/env node
/**
 * CORRECTOR AUTOMÁTICO DE SISTEMA DE PUERTOS DINÁMICOS
 * Corrige todos los problemas identificados en la validación
 */

const fs = require('fs');
const path = require('path');

class PortSystemCorrector {
    constructor() {
        this.workspaceRoot = '/workspace/iris-code-enhanced';
        this.errors = [];
        this.corrections = [];
        
        // Configuración correcta de puertos según .port-config.json
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
    }
    
    async runCompleteCorrection() {
        console.log('🔧 Iniciando corrección completa del sistema de puertos dinámicos...\n');
        
        // 1. Corregir rutas en docker-compose.dynamic.yml
        await this.fixDockerComposeRoutes();
        
        // 2. Corregir puertos en todos los Dockerfiles
        await this.fixAllDockerfiles();
        
        // 3. Corregir team names en archivos team.js
        await this.fixTeamNames();
        
        // 4. Sincronizar directorios de equipos
        await this.syncTeamDirectories();
        
        // 5. Corregir package.json con nombres correctos
        await this.fixPackageJsonNames();
        
        // 6. Generar reporte final
        this.generateCorrectionReport();
    }
    
    async fixDockerComposeRoutes() {
        console.log('🐳 Corrigiendo rutas en docker-compose.dynamic.yml...');
        
        const composePath = path.join(this.workspaceRoot, 'docker-compose.dynamic.yml');
        let content = fs.readFileSync(composePath, 'utf8');
        
        // Corregir ruta de business-development-team
        const oldPath = './src/silhouette/teams/business/business_development_team';
        const newPath = './src/silhouette/teams/business/business-development-team';
        
        if (content.includes(oldPath)) {
            content = content.replace(new RegExp(oldPath, 'g'), newPath);
            this.corrections.push('✅ Corregida ruta de business-development-team en docker-compose.yml');
        }
        
        // Corregir nombres de equipos para usar guiones en lugar de guiones bajos
        content = content.replace(/business_development_team/g, 'business_development_team');
        content = content.replace(/marketing_team/g, 'marketing_team');
        
        // Asegurar que todos los equipos estén definidos
        const teamsToEnsure = [
            {
                name: 'business-development-team',
                port: 8004,
                teamName: 'business_development_team'
            },
            {
                name: 'marketing-team',
                port: 8005,
                teamName: 'marketing_team'
            },
            {
                name: 'sales-team',
                port: 8006,
                teamName: 'sales_team'
            },
            {
                name: 'finance-team',
                port: 8007,
                teamName: 'finance_team'
            }
        ];
        
        // Verificar que todos los equipos estén en el docker-compose
        teamsToEnsure.forEach(team => {
            if (!content.includes(`${team.name}:`)) {
                const teamSection = `
  ${team.name}:
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

`;
                
                // Insertar antes de la sección de base de datos
                const insertPoint = content.lastIndexOf('  # =============================================================================\n  # BASE DE DATOS POSTGRESQL');
                if (insertPoint !== -1) {
                    content = content.substring(0, insertPoint) + teamSection + content.substring(insertPoint);
                }
                
                this.corrections.push(`✅ Agregado ${team.name} a docker-compose.yml`);
            }
        });
        
        fs.writeFileSync(composePath, content);
    }
    
    async fixAllDockerfiles() {
        console.log('🐳 Corrigiendo puertos en todos los Dockerfiles...');
        
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const team of teams) {
            const dockerfilePath = path.join(businessTeamsPath, team, 'Dockerfile');
            
            if (fs.existsSync(dockerfilePath)) {
                await this.fixSingleDockerfile(team, dockerfilePath);
            }
        }
    }
    
    async fixSingleDockerfile(teamName, dockerfilePath) {
        console.log(`   🔧 Corrigiendo Dockerfile de ${teamName}...`);
        
        let content = fs.readFileSync(dockerfilePath, 'utf8');
        let wasModified = false;
        
        // Corregir EXPOSE a 8000
        if (content.includes('EXPOSE 800') || content.includes('EXPOSE ${')) {
            content = content.replace(/EXPOSE\s+\d+/g, 'EXPOSE 8000');
            wasModified = true;
        }
        
        // Corregir TEAM_PORT a 8000
        if (content.includes('TEAM_PORT=')) {
            content = content.replace(/ENV\s+TEAM_PORT=\d+/g, 'ENV TEAM_PORT=8000');
            wasModified = true;
        }
        
        // Corregir TEAM_NAME
        const teamNameMap = {
            'business-development-team': 'business_development_team',
            'marketing_team': 'marketing_team',
            'sales-team': 'sales_team',
            'finance-team': 'finance_team',
            'cloud-services-team': 'cloud_services_team',
            'communications-team': 'communications_team',
            'customer-service-team': 'customer_service_team',
            'quality-assurance-team': 'quality_assurance_team',
            'support-team': 'support_team'
        };
        
        const mappedName = teamNameMap[teamName] || teamName.replace(/-/g, '_');
        
        if (content.includes('TEAM_NAME=')) {
            content = content.replace(/ENV\s+TEAM_NAME=[\w-]+/g, `ENV TEAM_NAME=${mappedName}`);
            wasModified = true;
        }
        
        if (wasModified) {
            fs.writeFileSync(dockerfilePath, content);
            this.corrections.push(`✅ Corregido Dockerfile de ${teamName}`);
        } else {
            console.log(`   ✅ Dockerfile de ${teamName} ya está correcto`);
        }
    }
    
    async fixTeamNames() {
        console.log('👥 Corrigiendo team names en archivos team.js...');
        
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const team of teams) {
            const teamJsPath = path.join(businessTeamsPath, team, 'team.js');
            
            if (fs.existsSync(teamJsPath)) {
                await this.fixSingleTeamJS(team, teamJsPath);
            }
        }
    }
    
    async fixSingleTeamJS(teamName, teamJsPath) {
        console.log(`   🔧 Corrigiendo team.js de ${teamName}...`);
        
        let content = fs.readFileSync(teamJsPath, 'utf8');
        
        // Mapeo de nombres de equipos
        const teamNameMap = {
            'business-development-team': 'business-development-team',
            'marketing_team': 'marketing-team',
            'sales-team': 'sales-team',
            'finance-team': 'finance-team',
            'cloud-services-team': 'cloud-services-team',
            'communications-team': 'communications-team',
            'customer-service-team': 'customer-service-team',
            'quality-assurance-team': 'quality-assurance-team',
            'support-team': 'support-team'
        };
        
        const correctName = teamNameMap[teamName] || teamName;
        
        // Asegurar que el team_name esté correcto
        const teamNameRegex = /team_name:\s*['"][\w-]+['"]/g;
        const newTeamName = `team_name: '${correctName}'`;
        
        if (content.match(teamNameRegex)) {
            content = content.replace(teamNameRegex, newTeamName);
            fs.writeFileSync(teamJsPath, content);
            this.corrections.push(`✅ Corregido team_name en ${teamName}/team.js`);
        } else {
            console.log(`   ⚠️ No se encontró team_name en ${teamName}/team.js`);
        }
    }
    
    async syncTeamDirectories() {
        console.log('📁 Sincronizando directorios de equipos...');
        
        // Verificar que marketing_team y marketing-team sean consistentes
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const marketingTeamDir = path.join(businessTeamsPath, 'marketing-team');
        const marketingTeamUnderscore = path.join(businessTeamsPath, 'marketing_team');
        
        if (fs.existsSync(marketingTeamUnderscore) && !fs.existsSync(marketingTeamDir)) {
            // Renombrar directorio
            fs.renameSync(marketingTeamUnderscore, marketingTeamDir);
            this.corrections.push('✅ Renombrado marketing_team a marketing-team para consistencia');
        }
        
        // Asegurar que todos los equipos target existan
        const requiredTeams = [
            'business-development-team',
            'marketing-team', 
            'sales-team',
            'finance-team'
        ];
        
        for (const team of requiredTeams) {
            const teamPath = path.join(businessTeamsPath, team);
            if (!fs.existsSync(teamPath)) {
                this.errors.push(`❌ Directorio faltante: ${team}`);
            }
        }
    }
    
    async fixPackageJsonNames() {
        console.log('📦 Corrigiendo nombres en package.json...');
        
        const businessTeamsPath = path.join(this.workspaceRoot, 'src/silhouette/teams/business');
        const teams = fs.readdirSync(businessTeamsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const team of teams) {
            const packageJsonPath = path.join(businessTeamsPath, team, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
                await this.fixSinglePackageJson(team, packageJsonPath);
            }
        }
    }
    
    async fixSinglePackageJson(teamName, packageJsonPath) {
        try {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            const pkg = JSON.parse(content);
            
            // Generar nombre correcto
            const nameMap = {
                'business-development-team': 'silhouette-business-development-team',
                'marketing-team': 'silhouette-marketing-team',
                'sales-team': 'silhouette-sales-team',
                'finance-team': 'silhouette-finance-team',
                'cloud-services-team': 'silhouette-cloud-services-team',
                'communications-team': 'silhouette-communications-team',
                'customer-service-team': 'silhouette-customer-service-team',
                'quality-assurance-team': 'silhouette-quality-assurance-team',
                'support-team': 'silhouette-support-team'
            };
            
            const correctName = nameMap[teamName] || `silhouette-${teamName}`;
            
            if (pkg.name !== correctName) {
                pkg.name = correctName;
                fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
                this.corrections.push(`✅ Corregido nombre en ${teamName}/package.json`);
            }
            
        } catch (error) {
            this.errors.push(`❌ Error corrigiendo package.json de ${teamName}: ${error.message}`);
        }
    }
    
    generateCorrectionReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 REPORTE FINAL DE CORRECCIÓN');
        console.log('='.repeat(80));
        
        console.log(`\n❌ ERRORES PENDIENTES: ${this.errors.length}`);
        this.errors.forEach(error => console.log(`   ${error}`));
        
        console.log(`\n✅ CORRECCIONES APLICADAS: ${this.corrections.length}`);
        this.corrections.forEach(correction => console.log(`   ${correction}`));
        
        console.log('\n' + '='.repeat(80));
        
        // Guardar reporte
        const reportPath = path.join(this.workspaceRoot, 'correccion-puertos-aplicada.json');
        const report = {
            timestamp: new Date().toISOString(),
            errors: this.errors,
            corrections: this.corrections,
            totalCorrections: this.corrections.length,
            status: this.errors.length === 0 ? 'completed' : 'partial'
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Reporte guardado en: ${reportPath}`);
    }
}

// Ejecutar corrección
if (require.main === module) {
    const corrector = new PortSystemCorrector();
    corrector.runCompleteCorrection().catch(console.error);
}

module.exports = PortSystemCorrector;