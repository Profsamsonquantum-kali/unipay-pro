const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// Import configs
const connectDB = require('./config/database');
const { initializeSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);

// ==================== SOCKET.IO SETUP ====================
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// ==================== DATABASE CONNECTION ====================
connectDB().catch(err => {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
});

// ==================== SOCKET.IO INITIALIZATION ====================
initializeSocket(io);

// ==================== TRUST PROXY ====================
app.set('trust proxy', 1);

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.socket.io", "https://s3.tradingview.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://via.placeholder.com"],
            connectSrc: ["'self'", "wss://", "https://api.stripe.com", "https://api.coingecko.com"]
        }
    }
}));
// Handle OPTIONS requests for all routes
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

// ==================== CORS CONFIGURATION - COMPLETE FIX ====================
const allowedOrigins = [
    'http://localhost:5000',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
    'https://fanciful-duckanoo-7072a6.netlify.app',
    'https://quantumpay.pages.dev',           // YOUR CLOUDFLARE DOMAIN
    'https://quantumpay-app.pages.dev',       // ALTERNATIVE CLOUDFLARE DOMAIN
    'https://quantum-via-pages.dev',          // ANOTHER VARIATION
    'https://your-netlify-site.netlify.app'
];

// Allow all origins in development
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        
        // Check if origin is allowed
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Log blocked origins for debugging
            console.log('⚠️ Blocked origin:', origin);
            callback(new Error('⚠️ Not allowed by CORS'));
            
            // FOR TESTING ONLY - REMOVE IN PRODUCTION
            // TEMPORARILY ALLOW ALL ORIGINS TO TEST
            callback(null, true);
            
            // IN PRODUCTION, USE THIS INSTEAD:
            // callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));
// 1. HEALTH CHECK - Make it CORS-friendly
app.get('/api/health', cors(), (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    
    res.status(200).json({
        status: 'success',
        message: 'QuantumPay API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '20.0.0',
        database: {
            status: dbStatus[dbState] || 'unknown',
            state: dbState,
            host: mongoose.connection.host || 'localhost',
            name: mongoose.connection.name || 'quantumpay'
        },
        uptime: process.uptime()
    });
});
console.log('🔒 CORS configured to allow:', allowedOrigins);

// ==================== BODY PARSER ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ==================== SECURITY SANITIZATION ====================
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// ==================== COMPRESSION ====================
app.use(compression());

// ==================== LOGGING ====================
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ==================== RATE LIMITING ====================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again later.'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        status: 'error',
        message: 'Too many authentication attempts, please try again later.'
    }
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);

// ==================== IMPORT ROUTES ====================
const routes = require('./api');

// ==================== ROUTES - IN CORRECT ORDER ====================

// 1. HEALTH CHECK - MUST BE FIRST
app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    
    res.status(200).json({
        status: 'success',
        message: 'QuantumPay API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '20.0.0',
        database: {
            status: dbStatus[dbState] || 'unknown',
            state: dbState,
            host: mongoose.connection.host || 'localhost',
            name: mongoose.connection.name || 'quantumpay'
        },
        uptime: process.uptime()
    });
});

// 2. API ROUTES
app.use('/api/v1', routes);

// 3. TEST ROUTE (direct in app.js for verification)
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'App.js test route working',
        timestamp: new Date().toISOString()
    });
});

// 4. STATIC FILES
app.use(express.static(path.join(__dirname)));

// 5. HTML ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 6. 404 HANDLER FOR API (catch any unmatched /api/* routes)
app.use('/api/*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// 7. CATCH-ALL FOR FRONTEND (LAST)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    console.error('❌ Stack:', err.stack);
    
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    const status = err.statusCode || 500;
    
    if (req.originalUrl.startsWith('/api')) {
        return res.status(status).json({
            status: 'error',
            message: message
        });
    }
    
    res.status(status).send(`
        <html>
            <head><title>Error</title></head>
            <body>
                <h1>${status} Error</h1>
                <p>${message}</p>
                <a href="/">Go Home</a>
            </body>
        </html>
    `);
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('💰 QUANTUMPAY V20 ULTIMATE PRO BACKEND');
    console.log('='.repeat(70));
    console.log(`📍 Server:       http://localhost:${PORT}`);
    console.log(`📍 API:          http://localhost:${PORT}/api/v1`);
    console.log(`📍 Health:       http://localhost:${PORT}/api/health`);
    console.log(`📍 Test:         http://localhost:${PORT}/api/test`);
    console.log(`📍 Dashboard:    http://localhost:${PORT}/dashboard.html`);
    console.log(`📍 Environment:  ${process.env.NODE_ENV || 'development'}`);
    
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? '✅ CONNECTED' : '❌ DISCONNECTED';
    console.log(`📍 Database:     ${dbStatus}`);
    console.log('='.repeat(70) + '\n');
});

// ==================== GRACEFUL SHUTDOWN ====================
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received, closing connections...`);
    
    io.close(() => {
        console.log('🔌 WebSocket server closed');
        server.close(() => {
            console.log('🌐 HTTP server closed');
            mongoose.connection.close(false, () => {
                console.log('🗄️  Database connection closed');
                console.log('👋 Server shutdown complete');
                process.exit(0);
            });
        });
    });
    
    setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
    console.log('❌ UNHANDLED REJECTION!');
    console.log(err.name, err.message);
});

process.on('uncaughtException', (err) => {
    console.log('❌ UNCAUGHT EXCEPTION!');
    console.log(err.name, err.message);
});

module.exports = { app, server, io };
