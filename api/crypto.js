const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// ==================== AUTH MIDDLEWARE ====================
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ 
            status: 'error', 
            message: 'Invalid token' 
        });
    }
};

// ==================== GET CRYPTO PRICES ====================
router.get('/prices', async (req, res) => {
    try {
        // Try to get real prices from CoinGecko
        let prices = {};
        
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: 'bitcoin,ethereum,binancecoin,solana,ripple,cardano',
                    vs_currencies: 'usd',
                    include_24hr_change: true
                },
                timeout: 5000
            });

            prices = {
                'BTC/USD': {
                    last: response.data.bitcoin?.usd || 51234.50,
                    change24h: response.data.bitcoin?.usd_24h_change || 2.5
                },
                'ETH/USD': {
                    last: response.data.ethereum?.usd || 3123.45,
                    change24h: response.data.ethereum?.usd_24h_change || 1.8
                },
                'BNB/USD': {
                    last: response.data.binancecoin?.usd || 412.75,
                    change24h: response.data.binancecoin?.usd_24h_change || -0.5
                },
                'SOL/USD': {
                    last: response.data.solana?.usd || 123.45,
                    change24h: response.data.solana?.usd_24h_change || 5.2
                }
            };
        } catch (error) {
            // Fallback prices
            prices = {
                'BTC/USD': { last: 51234.50, change24h: 2.5 },
                'ETH/USD': { last: 3123.45, change24h: 1.8 },
                'BNB/USD': { last: 412.75, change24h: -0.5 },
                'SOL/USD': { last: 123.45, change24h: 5.2 }
            };
        }

        res.json({ status: 'success', data: { prices } });

    } catch (error) {
        console.error('Price fetch error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== GET CRYPTO BALANCE ====================
router.get('/balance', authenticate, async (req, res) => {
    try {
        res.json({
            status: 'success',
            data: { crypto: req.user.crypto || {} }
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== BUY CRYPTO ====================
router.post('/buy', authenticate, async (req, res) => {
    try {
        const { crypto, amount, currency } = req.body;

        // Check fiat balance
        const fiatBalance = req.user.balances?.[currency] || 0;
        if (fiatBalance < amount) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Insufficient balance' 
            });
        }

        // Get current price
        const rates = { BTC: 51234.50, ETH: 3123.45, BNB: 412.75, SOL: 123.45 };
        const price = rates[crypto] || 50000;
        const cryptoAmount = amount / price;

        // Update balances
        req.user.balances[currency] -= amount;
        if (!req.user.crypto) req.user.crypto = {};
        req.user.crypto[crypto] = (req.user.crypto[crypto] || 0) + cryptoAmount;
        
        await req.user.save();

        res.json({
            status: 'success',
            data: {
                cryptoAmount,
                newBalance: req.user.crypto[crypto],
                newFiatBalance: req.user.balances[currency]
            }
        });

    } catch (error) {
        console.error('Buy crypto error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== SELL CRYPTO ====================
router.post('/sell', authenticate, async (req, res) => {
    try {
        const { crypto, amount, currency } = req.body;

        // Check crypto balance
        const cryptoBalance = req.user.crypto?.[crypto] || 0;
        if (cryptoBalance < amount) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Insufficient crypto balance' 
            });
        }

        // Get current price
        const rates = { BTC: 51234.50, ETH: 3123.45, BNB: 412.75, SOL: 123.45 };
        const price = rates[crypto] || 50000;
        const fiatAmount = amount * price;

        // Update balances
        req.user.crypto[crypto] -= amount;
        req.user.balances[currency] = (req.user.balances[currency] || 0) + fiatAmount;
        
        await req.user.save();

        res.json({
            status: 'success',
            data: {
                fiatAmount,
                newCryptoBalance: req.user.crypto[crypto],
                newFiatBalance: req.user.balances[currency]
            }
        });

    } catch (error) {
        console.error('Sell crypto error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;