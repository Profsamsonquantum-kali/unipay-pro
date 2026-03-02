const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const paymentRoutes = require('./payments');
const cryptoRoutes = require('./crypto');
const bankRoutes = require('./banks');
const cardRoutes = require('./cards');
const loanRoutes = require('./loans');
const investmentRoutes = require('./investments');
const adminRoutes = require('./admin');
const mobilemoneyRoutes = require('./mobileMoney');
// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '20.0.0'
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/crypto', cryptoRoutes);
router.use('/banks', bankRoutes);
router.use('/cards', cardRoutes);
router.use('/loans', loanRoutes);
router.use('/investments', investmentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
