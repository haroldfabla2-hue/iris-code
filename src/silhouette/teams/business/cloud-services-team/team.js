const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        team: 'cloud-services-team',
        version: '4.0.0' 
    });
});

app.post('/execute', (req, res) => {
    res.json({ 
        success: true, 
        team: 'cloud-services-team',
        message: 'Equipo cloud-services-team funcionando' 
    });
});

app.listen(8000, () => {
    console.log('cloud-services-team iniciado en puerto 8000');
});