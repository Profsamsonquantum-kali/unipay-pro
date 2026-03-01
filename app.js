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
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

// Import routes
const routes = require('./api');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true
    }
});

// ==================== DATABASE CONNECTION ====================
connectDB();

// ==================== SOCKET.IO ====================
initializeSocket(io);

// ==================== GLOBAL MIDDLEWARE ====================

// Security HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://via.placeholder.com"],
            connectSrc: ["'self'", "wss://", "https://api.stripe.com", "https://api.coingecko.com"]
        }
    }
}));

// CORS
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ==================== ROUTES ====================
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'QuantumPay API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: '20.0.0'
    });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
        return next(new AppError('API endpoint not found', 404));
    }
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ==================== ERROR HANDLING ====================
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('💰 QUANTUMPAY V20 ULTIMATE PRO');
    console.log('='.repeat(70));
    console.log(`📍 Server:       http://localhost:${PORT}`);
    console.log(`📍 API:          http://localhost:${PORT}/api/v1`);
    console.log(`📍 Dashboard:    http://localhost:${PORT}/dashboard.html`);
    console.log(`📍 Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 Database:     ${mongoose.connection.readyState === 1 ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
    console.log('='.repeat(70) + '\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
});
