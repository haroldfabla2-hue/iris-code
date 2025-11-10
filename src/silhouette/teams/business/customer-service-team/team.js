const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        team: 'customer-service-team',
        version: '4.0.0' 
    });
});

app.post('/execute', (req, res) => {
    res.json({ 
        success: true, 
        team: 'customer-service-team',
        message: 'Equipo customer-service-team funcionando' 
    });
});

app.listen(8000, () => {
    console.log('customer-service-team iniciado en puerto 8000');
});