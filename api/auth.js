const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ==================== TEST ROUTE ====================
router.get('/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Auth router is working!',
        endpoints: ['POST /register', 'POST /login', 'GET /verify', 'POST /forgot-password']
    });
});

// ==================== REGISTER ====================
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, country, password } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone || !country || !password) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'All fields are required' 
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'User already exists with this email or phone' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate referral code
        const referralCode = 'QTP' + uuidv4().substring(0, 8).toUpperCase();

        // Create user with all required fields
        const user = new User({
            firstName,
            lastName,
            email,
            phone,
            country,
            password: hashedPassword,
            referralCode,
            balances: {
                USD: 1000, // Welcome bonus
                EUR: 0,
                GBP: 0,
                KES: 15000,
                NGN: 150000,
                ZAR: 1800,
                GHS: 0,
                TZS: 0,
                UGX: 0
            },
            crypto: {
                BTC: 0.001,
                ETH: 0.01,
                USDT: 0,
                USDC: 0,
                BNB: 0,
                SOL: 0,
                XRP: 0,
                ADA: 0
            },
            isEmailVerified: false,
            isPhoneVerified: false
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Return user data (without password)
        const userData = user.toObject();
        delete userData.password;

        res.status(201).json({
            status: 'success',
            token,
            data: { user: userData }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Email and password are required' 
            });
        }

        // Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Invalid email or password' 
            });
        }

        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Invalid email or password' 
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Return user data (without password)
        const userData = user.toObject();
        delete userData.password;

        res.json({
            status: 'success',
            token,
            data: { user: userData }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== VERIFY TOKEN ====================
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }

        res.json({
            status: 'success',
            data: { user }
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(401).json({ 
            status: 'error', 
            message: 'Invalid token' 
        });
    }
});

// ==================== FORGOT PASSWORD ====================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }

        // In production, send email here
        res.json({ 
            status: 'success', 
            message: 'Password reset link sent to your email' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;