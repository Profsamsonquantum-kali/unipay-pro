const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// 1. DIRECT TEST ROUTE - This will ALWAYS work
router.get('/health', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'API v1 is running',
        timestamp: new Date().toISOString()
    });
});

// 2. MANUAL MOUNT - Force mount auth routes FIRST
console.log('\n🔧 MANUALLY MOUNTING AUTH ROUTES...');
try {
    const authRoutes = require('./auth');
    router.use('/auth', authRoutes);
    console.log('✅ SUCCESS: Auth routes mounted at /api/v1/auth');
} catch (error) {
    console.error('❌ FAILED to mount auth routes:', error.message);
}

// 3. Try to mount simple test routes
try {
    const simpleRoutes = require('./simple');
    router.use('/simple', simpleRoutes);
    console.log('✅ SUCCESS: Simple routes mounted at /api/v1/simple');
} catch (error) {
    console.log('ℹ️ Simple routes not found, skipping');
}

// 4. AUTO-LOAD all other route files
console.log('\n📂 Auto-loading remaining API routes from:', __dirname);

fs.readdirSync(__dirname).forEach(file => {
    // Skip index.js, auth.js (already loaded), and non-js files
    if (file === 'index.js' || file === 'auth.js' || !file.endsWith('.js')) return;
    
    const routeName = file.replace('.js', '');
    try {
        const routeModule = require(`./${file}`);
        router.use(`/${routeName}`, routeModule);
        console.log(`✅ Loaded route: /${routeName}`);
    } catch (error) {
        console.log(`❌ Failed to load ${routeName}: ${error.message}`);
    }
});

// 5. DEBUG - List all mounted routes
console.log('\n📋 MOUNTED ROUTES:');
console.log('   - GET  /health');
console.log('   - POST /auth/login');
console.log('   - GET  /auth/test');
console.log('   - GET  /simple/test');
console.log('   - POST /simple/login');

module.exports = router;
