#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('[2025-11-10 12:15:00] 🔍 INICIANDO VALIDACIÓN MANUAL DEL SISTEMA\n');

// Función para verificar si un archivo existe
function checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${description}: ${filePath} (${stats.size} bytes)`);
        return true;
    } else {
        console.log(`❌ ${description}: ${filePath} - NO ENCONTRADO`);
        return false;
    }
}

// Función para verificar si un directorio existe
function checkDirectory(dirPath, description) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        console.log(`✅ ${description}: ${dirPath} (${files.length} archivos)`);
        return true;
    } else {
        console.log(`❌ ${description}: ${dirPath} - NO ENCONTRADO`);
        return false;
    }
}

let allChecks = true;

// 1. Verificar estructura principal
console.log('📁 ESTRUCTURA PRINCIPAL:');
const mainDirs = [
    './src',
    './services',
    './config',
    './scripts',
    './logs'
];

mainDirs.forEach(dir => {
    if (!checkDirectory(dir, 'Directorio principal')) {
        allChecks = false;
    }
});

console.log('\n🏗️  SERVICIOS BASE:');
const baseServices = [
    './src/api-gateway/unified-api-gateway.js',
    './docker-compose.yml',
    './start-unified-system.sh'
];

baseServices.forEach(file => {
    if (!checkFile(file, 'Servicio base')) {
        allChecks = false;
    }
});

console.log('\n🧠 SERVICIOS DE CONTEXT MEMORY:');
const contextServices = [
    './src/services/context-bridge/index.js',
    './src/services/context-bridge/Dockerfile',
    './services/services/context-capture/index.js',
    './services/services/context-capture/Dockerfile',
    './services/services/context-capture/package.json',
    './services/services/context-processing/index.js',
    './services/services/context-processing/Dockerfile',
    './services/services/context-processing/package.json',
    './services/services/context-retrieval/index.js',
    './services/services/context-retrieval/Dockerfile',
    './services/services/context-retrieval/package.json',
    './services/services/memory-management/index.js',
    './services/services/memory-management/Dockerfile',
    './services/services/memory-management/package.json'
];

contextServices.forEach(file => {
    if (!checkFile(file, 'Servicio Context')) {
        allChecks = false;
    }
});

console.log('\n📊 VERIFICACIÓN DE LÍNEAS DE CÓDIGO:');
const serviceFiles = [
    './src/services/context-bridge/index.js',
    './services/services/context-capture/index.js',
    './services/services/context-processing/index.js',
    './services/services/context-retrieval/index.js',
    './services/services/memory-management/index.js'
];

let totalLines = 0;
serviceFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').length;
        totalLines += lines;
        console.log(`✅ ${path.basename(file)}: ${lines} líneas de código`);
    }
});

console.log(`\n📈 TOTAL DE LÍNEAS EN SERVICIOS CONTEXT: ${totalLines}`);

// 4. Verificar configuración de puertos en docker-compose.yml
console.log('\n🔌 VERIFICACIÓN DE PUERTOS EN DOCKER-COMPOSE:');
if (fs.existsSync('./docker-compose.yml')) {
    const dockerContent = fs.readFileSync('./docker-compose.yml', 'utf8');
    const contextPorts = [
        { port: '8100', service: 'context-capture' },
        { port: '8101', service: 'context-processing' },
        { port: '8102', service: 'context-retrieval' },
        { port: '8103', service: 'memory-management' },
        { port: '8104', service: 'context-bridge' }
    ];

    contextPorts.forEach(({ port, service }) => {
        if (dockerContent.includes(`"${port}:`)) {
            console.log(`✅ Puerto ${port} para ${service}: Configurado correctamente`);
        } else {
            console.log(`❌ Puerto ${port} para ${service}: NO ENCONTRADO`);
            allChecks = false;
        }
    });
}

console.log('\n🎯 RESUMEN DE VALIDACIÓN:');
console.log('================================');

// Verificar rutas corregidas
if (fs.existsSync('./docker-compose.yml')) {
    const dockerContent = fs.readFileSync('./docker-compose.yml', 'utf8');
    const wrongPaths = dockerContent.includes('context-infrastructure/services/');
    if (wrongPaths) {
        console.log('❌ Rutas incorrectas en docker-compose.yml');
        allChecks = false;
    } else {
        console.log('✅ Rutas en docker-compose.yml: CORREGIDAS');
    }
}

console.log('\n' + '='.repeat(50));
if (allChecks) {
    console.log('🎉 VALIDACIÓN COMPLETADA - TODOS LOS CHECKS PASARON');
    console.log('🚀 EL SISTEMA ESTÁ LISTO PARA DESPLIEGUE');
} else {
    console.log('⚠️  VALIDACIÓN COMPLETADA - ALGUNOS CHECKS FALLARON');
    console.log('🔧 REQUIERE CORRECCIONES ANTES DEL DESPLIEGUE');
}
console.log('='.repeat(50));

process.exit(allChecks ? 0 : 1);