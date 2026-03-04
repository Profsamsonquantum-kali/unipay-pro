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

// ==================== SIMPLIFIED CORS CONFIGURATION ====================
const allowedOrigins = [
    'http://localhost:5000',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
    'https://fanciful-duckanoo-7072a6.netlify.app',
    'https://quantumpay.pages.dev',
    'https://quantumpay-app.pages.dev',
    'https://quantum-via.pages.dev'
];

// CORS middleware
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('⚠️ Blocked origin:', origin);
            callback(null, true); // TEMPORARY - REMOVE IN PRODUCTION
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());

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

// ==================== ROUTES ====================

// 1. HEALTH CHECK
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

// 2. API ROUTES
app.use('/api/v1', routes);

// 3. TEST ROUTE
app.get('/api/test', cors(), (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'App.js test route working',
        timestamp: new Date().toISOString()
    });
});

// ==================== STATIC FILES (CSS, JS, IMAGES) ====================
// This serves everything in the root directory
app.use(express.static(path.join(__dirname)));

// ==================== HTML ROUTES ====================

// Root route - serves index.html
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    console.log('📄 Serving index.html from:', filePath);
    res.sendFile(filePath);
});

// Dashboard route - serves dashboard.html
app.get('/dashboard', (req, res) => {
    const filePath = path.join(__dirname, 'dashboard.html');
    console.log('📄 Serving dashboard.html from:', filePath);
    res.sendFile(filePath);
});

// Also serve dashboard.html directly
app.get('/dashboard.html', (req, res) => {
    const filePath = path.join(__dirname, 'dashboard.html');
    console.log('📄 Serving dashboard.html from:', filePath);
    res.sendFile(filePath);
});

// ==================== 404 HANDLER ====================
app.use('/api/*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// ==================== CATCH-ALL FOR FRONTEND ====================
// This handles any other routes by serving index.html (for SPA behavior)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes (already handled above)
    if (!req.originalUrl.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
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
    console.log(`📍 Index:        http://localhost:${PORT}/`);
    console.log(`📍 Dashboard:    http://localhost:${PORT}/dashboard`);
    console.log(`📍 Dashboard:    http://localhost:${PORT}/dashboard.html`);
    console.log(`📍 Static files: http://localhost:${PORT}/[filename]`);
    console.log(`📍 Environment:  ${process.env.NODE_ENV || 'development'}`);
    
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? '✅ CONNECTED' : '❌ DISCONNECTED';
    console.log(`📍 Database:     ${dbStatus}`);
    console.log('='.repeat(70) + '\n');
    
    // List important files
    const fs = require('fs');
    const files = ['index.html', 'dashboard.html', 'css/main.css', 'js/quantum-animation.js'];
    files.forEach(file => {
        const fullPath = path.join(__dirname, file);
        const exists = fs.existsSync(fullPath);
        console.log(`📁 ${file}: ${exists ? '✅ Found' : '❌ Missing'}`);
    });
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
