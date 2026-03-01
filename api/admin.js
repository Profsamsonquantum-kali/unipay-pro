const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Loan = require('../models/Loan');
const auth = require('../middleware/auth');

// Admin middleware
const isAdmin = async (req, res, next) => {
    if (req.user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get system stats
router.get('/stats', auth, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTransactions = await Transaction.countDocuments();
        const totalLoans = await Loan.countDocuments();
        
        const totalVolume = await Transaction.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('-password');

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalTransactions,
                totalLoans,
                totalVolume: totalVolume[0]?.total || 0
            },
            recentUsers
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all users
router.get('/users', auth, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await User.countDocuments();

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all transactions
router.get('/transactions', auth, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const transactions = await Transaction.find()
            .populate('userId', 'email firstName lastName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Transaction.countDocuments();

        res.json({
            success: true,
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user
router.put('/users/:userId', auth, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Remove sensitive fields
        delete updates.password;
        delete updates._id;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Suspend user
router.post('/users/:userId/suspend', auth, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        await User.findByIdAndUpdate(userId, {
            suspended: true,
            suspensionReason: reason,
            suspendedAt: new Date()
        });

        res.json({
            success: true,
            message: 'User suspended'
        });

    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get system logs (simplified)
router.get('/logs', auth, isAdmin, async (req, res) => {
    try {
        // In production, you'd read from actual log files
        const logs = [
            { timestamp: new Date(), level: 'info', message: 'System started' },
            { timestamp: new Date(), level: 'info', message: 'Database connected' }
        ];

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;