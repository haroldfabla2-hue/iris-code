const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        team: 'support-team',
        version: '4.0.0' 
    });
});

app.post('/execute', (req, res) => {
    res.json({ 
        success: true, 
        team: 'support-team',
        message: 'Equipo support-team funcionando' 
    });
});

app.listen(8000, () => {
    console.log('support-team iniciado en puerto 8000');
});