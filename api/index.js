// api/index.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Add a direct health check
router.get('/health', (req, res) => {
    res.json({
        status: 'success',
        message: 'API v1 is running',
        timestamp: new Date().toISOString()
    });
});

// Log all loaded routes
console.log('\n📂 Loading API routes from:', __dirname);

// Load all route files
fs.readdirSync(__dirname).forEach(file => {
    if (file === 'index.js' || !file.endsWith('.js')) return;
    
    const routeName = file.replace('.js', '');
    try {
        const routeModule = require(`./${file}`);
        router.use(`/${routeName}`, routeModule);
        console.log(`✅ Loaded route: /${routeName}`);
    } catch (error) {
        console.log(`❌ Failed to load ${routeName}: ${error.message}`);
    }
});

console.log('✅ API routes loaded successfully\n');

module.exports = router;
