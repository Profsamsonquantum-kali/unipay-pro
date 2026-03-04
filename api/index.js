const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'API v1 is running',
        timestamp: new Date().toISOString(),
        endpoints: [
            '/auth/* - Authentication routes',
            '/users/* - User management',
            '/cards/* - Card operations',
            '/crypto/* - Cryptocurrency',
            '/investments/* - Investments',
            '/loans/* - Loan management',
            '/transactions/* - Transactions',
            '/mobile-money/* - Mobile money',
            '/banking/* - Banking operations'
        ]
    });
});

// ==================== LOAD ALL ROUTES DYNAMICALLY ====================
console.log('\n📂 Loading API routes from:', __dirname);

const routeFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js'
);

routeFiles.forEach(file => {
    const routeName = file.replace('.js', '');
    try {
        const routeModule = require(`./${file}`);
        router.use(`/${routeName}`, routeModule);
        console.log(`✅ Loaded route: /${routeName}`);
    } catch (error) {
        console.error(`❌ Failed to load ${routeName}:`, error.message);
    }
});

// ==================== 404 HANDLER FOR API ====================
router.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
            'GET /health',
            'POST /auth/register',
            'POST /auth/login',
            'GET /auth/verify',
            'GET /users/me',
            'GET /users/balance',
            'GET /users/transactions',
            'POST /transactions/send',
            'GET /cards',
            'POST /cards/create',
            'GET /crypto/prices',
            'GET /crypto/balance',
            'POST /crypto/buy',
            'POST /crypto/sell',
            'GET /investments',
            'POST /investments/buy',
            'GET /loans',
            'POST /loans/apply',
            'POST /mobile-money/mpesa',
            'GET /banking/balances',
            'POST /banking/send'
        ]
    });
});

module.exports = router;