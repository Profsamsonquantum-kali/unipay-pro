const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const axios = require('axios');

// Fix: Import Web3 correctly
const { Web3 } = require('web3');

// Initialize Web3 with error handling
let web3;
try {
    if (process.env.ETHEREUM_RPC_URL) {
        web3 = new Web3(process.env.ETHEREUM_RPC_URL);
        console.log('✅ Web3 initialized');
    } else {
        console.log('⚠️ ETHEREUM_RPC_URL not set, using fallback');
        web3 = new Web3('https://mainnet.infura.io/v3/your-project-id');
    }
} catch (error) {
    console.error('❌ Web3 initialization failed:', error);
    web3 = null;
}

// ==================== GET CRYPTO PRICES ====================
router.get('/prices', async (req, res) => {
    try {
        // Try to get real prices from CoinGecko
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: 'bitcoin,ethereum,binancecoin,solana,ripple,cardano',
                vs_currencies: 'usd',
                include_24hr_change: true
            },
            timeout: 5000
        });

        const prices = {
            'BTC/USDT': {
                last: response.data.bitcoin?.usd || 51234.50,
                change24h: response.data.bitcoin?.usd_24h_change || 2.5
            },
            'ETH/USDT': {
                last: response.data.ethereum?.usd || 3123.45,
                change24h: response.data.ethereum?.usd_24h_change || 1.8
            },
            'BNB/USDT': {
                last: response.data.binancecoin?.usd || 412.75,
                change24h: response.data.binancecoin?.usd_24h_change || -0.5
            },
            'SOL/USDT': {
                last: response.data.solana?.usd || 123.45,
                change24h: response.data.solana?.usd_24h_change || 5.2
            }
        };

        res.json({ success: true, prices });
    } catch (error) {
        console.error('Price fetch error:', error);
        // Return fallback prices
        res.json({
            success: true,
            prices: {
                'BTC/USDT': { last: 51234.50, change24h: 2.5 },
                'ETH/USDT': { last: 3123.45, change24h: 1.8 },
                'BNB/USDT': { last: 412.75, change24h: -0.5 },
                'SOL/USDT': { last: 123.45, change24h: 5.2 }
            }
        });
    }
});

// ==================== GET USER CRYPTO BALANCE ====================
router.get('/balance', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('crypto');
        res.json({
            success: true,
            crypto: user.crypto || {
                BTC: 0, ETH: 0, BNB: 0, SOL: 0, USDT: 0
            }
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== BUY CRYPTO ====================
router.post('/buy', auth, async (req, res) => {
    try {
        const { crypto, amount, currency } = req.body;

        const user = await User.findById(req.userId);

        // Check fiat balance
        if (!user.balances || !user.balances[currency] || user.balances[currency] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Get current price
        const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: crypto.toLowerCase(),
                vs_currencies: 'usd'
            }
        });

        const price = priceResponse.data[crypto.toLowerCase()]?.usd || 50000;
        const cryptoAmount = amount / price;

        // Update balances
        user.balances[currency] -= amount;
        if (!user.crypto) user.crypto = {};
        user.crypto[crypto] = (user.crypto[crypto] || 0) + cryptoAmount;
        await user.save();

        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'buy',
            amount: cryptoAmount,
            currency: crypto,
            fromCurrency: currency,
            fromAmount: amount,
            status: 'completed',
            reference: 'BUY-' + Date.now()
        });
        await transaction.save();

        res.json({
            success: true,
            cryptoAmount,
            newBalance: user.crypto[crypto]
        });
    } catch (error) {
        console.error('Buy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SELL CRYPTO ====================
router.post('/sell', auth, async (req, res) => {
    try {
        const { crypto, amount, currency } = req.body;

        const user = await User.findById(req.userId);

        // Check crypto balance
        if (!user.crypto || !user.crypto[crypto] || user.crypto[crypto] < amount) {
            return res.status(400).json({ error: 'Insufficient crypto balance' });
        }

        // Get current price
        const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: crypto.toLowerCase(),
                vs_currencies: 'usd'
            }
        });

        const price = priceResponse.data[crypto.toLowerCase()]?.usd || 50000;
        const fiatAmount = amount * price;

        // Update balances
        user.crypto[crypto] -= amount;
        if (!user.balances) user.balances = {};
        user.balances[currency] = (user.balances[currency] || 0) + fiatAmount;
        await user.save();

        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'sell',
            amount,
            currency: crypto,
            toCurrency: currency,
            toAmount: fiatAmount,
            status: 'completed',
            reference: 'SELL-' + Date.now()
        });
        await transaction.save();

        res.json({
            success: true,
            fiatAmount,
            newBalance: user.balances[currency]
        });
    } catch (error) {
        console.error('Sell error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SEND CRYPTO ====================
router.post('/send', auth, async (req, res) => {
    try {
        const { crypto, toAddress, amount } = req.body;

        const user = await User.findById(req.userId);

        // Check balance
        if (!user.crypto || !user.crypto[crypto] || user.crypto[crypto] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // In a real app, you would send actual crypto here
        // For now, just deduct from balance
        user.crypto[crypto] -= amount;
        await user.save();

        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'send',
            amount,
            currency: crypto,
            toAddress,
            status: 'completed',
            reference: 'CRYPTO-SEND-' + Date.now()
        });
        await transaction.save();

        res.json({
            success: true,
            transaction,
            newBalance: user.crypto[crypto]
        });
    } catch (error) {
        console.error('Send crypto error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
