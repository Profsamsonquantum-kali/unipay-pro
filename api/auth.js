const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const twilio = require('../sms/twilio');
const { v4: uuidv4 } = require('uuid');

// Register
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
            return res.status(400).json({ error: 'User already exists' });
        }

        // Generate referral code
        const referralCode = 'QTP' + Math.random().toString(36).substring(2, 10).toUpperCase();


        // Create user
        const user = new User({
            firstName,
            lastName,
            email,
            phone,
            country,
            password,
            referralCode,
            balances: {
                USD: 100, // Welcome bonus
                KES: 15000,
                NGN: 150000,
                ZAR: 1800
            },
            crypto: {
                BTC: 0.001,
                ETH: 0.01
            }
        });

        await user.save();

        // Send welcome SMS
        await twilio.sendSMS(
            phone,
            `🎉 Welcome to QuantumPay, ${firstName}! Your account is ready.`
        );

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            status: 'success',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                country: user.country
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Email and password are required' 
            });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Invalid credentials' 
            });
        }

        const isValid = await user.correctPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Invalid credentials' 
            });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        const userData = user.toObject();
        delete userData.password;
        delete userData.__v;

        res.json({
            status: 'success',
            token,
            data: { user: userData }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: process.env.NODE_ENV === 'production' 
                ? 'Login failed' 
                : error.message 
        });
    }
});
        // IMPORTANT: Match frontend expected format
        res.json({
            status: 'success',
            token,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    country: user.country
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({status: 'error', message: 'No token provided'});
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({status: 'error', message: 'User not found' });
        }

        res.json({
            status: 'success',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                country: user.country
            }
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(401).json({status: 'error', message: 'Invalid tokes});
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET + user.password,
            { expiresIn: '1h' }
        );

        // TODO: Send email with reset link
        // await email.sendPasswordReset(user.email, resetToken);

        res.json({
            success: true,
            message: 'Password reset email sent'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
