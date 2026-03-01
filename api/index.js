const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./api/auth');
const userRoutes = require('./api/users');
const paymentRoutes = require('./api/payments');
const cryptoRoutes = require('./api/crypto');
const bankRoutes = require('./api/banks');
const cardRoutes = require('./api/cards');
const loanRoutes = require('./api/loans');
const investmentRoutes = require('./api/investments');
const adminRoutes = require('./api/admin');

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