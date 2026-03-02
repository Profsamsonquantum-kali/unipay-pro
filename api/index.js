const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const routes = {};

// Dynamically load all route files
fs.readdirSync(__dirname).forEach(file => {
  // Skip index.js itself, non-js files, and directories
  if (file === 'index.js' || !file.endsWith('.js')) return;
  
  const routeName = file.replace('.js', '');
  try {
    routes[routeName] = require(`./${routeName}`);
    console.log(`✅ Loaded route: ${routeName}`);
  } catch (error) {
    console.log(`❌ Failed to load ${routeName}: ${error.message}`);
  }
});

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '20.0.0'
    });
});

// Mount routes dynamically
Object.keys(routes).forEach(routeName => {
  // Use the route name as the path (e.g., /auth, /users, etc.)
  router.use(`/${routeName}`, routes[routeName]);
  console.log(`🔄 Mounted route: /${routeName}`);
});

// Special case for mobileMoney (if you want it as /mobile-money instead of /mobileMoney)
if (routes.mobileMoney) {
  router.use('/mobile-money', routes.mobileMoney);
  console.log(`🔄 Mounted route: /mobile-money`);
}

module.exports = router;
