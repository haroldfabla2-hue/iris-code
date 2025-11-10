const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        team: 'communications-team',
        version: '4.0.0' 
    });
});

app.post('/execute', (req, res) => {
    res.json({ 
        success: true, 
        team: 'communications-team',
        message: 'Equipo communications-team funcionando' 
    });
});

app.listen(8000, () => {
    console.log('communications-team iniciado en puerto 8000');
});