const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// ==================== IMPORT MODELS ====================
const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');
const Card = require('./models/Card');
const Loan = require('./models/Loan');
const Referral = require('./models/Referral');
const Investment = require('./models/Investment');
const Staking = require('./models/Staking');
const NFT = require('./models/NFT');
const BusinessAccount = require('./models/BusinessAccount');
const Invoice = require('./models/Invoice');
const Reward = require('./models/Reward');
const Device = require('./models/Device');
const ActivityLog = require('./models/ActivityLog');

// ==================== CREATE EXPRESS APP FIRST ====================
const app = express();
const server = http.createServer(app);

// ==================== JWT CONFIGURATION ====================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MAX_TOKEN_SIZE = 2048; // 2KB max token size

// ==================== SECURITY MONITOR ====================
class SecurityMonitor {
  constructor() {
    this.suspiciousActivities = new Map();
    this.blockedIPs = new Set();
    this.maxActivitiesPerHour = 10;
  }

  logSuspiciousActivity(ip, reason, details) {
    if (!this.suspiciousActivities.has(ip)) {
      this.suspiciousActivities.set(ip, []);
    }
    
    this.suspiciousActivities.get(ip).push({
      timestamp: Date.now(),
      reason,
      details
    });

    // Clean old activities (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentActivities = this.suspiciousActivities.get(ip)
      .filter(a => a.timestamp > oneHourAgo);

    if (recentActivities.length > this.maxActivitiesPerHour) {
      this.blockedIPs.add(ip);
      console.warn(`🚫 IP ${ip} blocked due to excessive suspicious activity`);
    }

    console.warn(`⚠️ Suspicious activity from ${ip}:`, { reason, details });
  }

  checkToken(token, ip) {
    // Check for malformed tokens
    if (!token) return true;

    if (token.length > MAX_TOKEN_SIZE) {
      this.logSuspiciousActivity(ip, 'TOKEN_TOO_LARGE', { size: token.length });
      return false;
    }

    // Check for repetitive patterns (potential attack)
    if (/(.{20,})\1{3,}/.test(token)) {
      this.logSuspiciousActivity(ip, 'REPETITIVE_TOKEN_PATTERN', { 
        pattern: token.substring(0, 100) 
      });
      return false;
    }

    // Check JWT structure
    const parts = token.split('.');
    if (parts.length !== 3) {
      this.logSuspiciousActivity(ip, 'INVALID_TOKEN_STRUCTURE', { parts: parts.length });
      return false;
    }

    // Verify each part is base64url encoded
    try {
      parts.forEach(part => {
        if (!/^[A-Za-z0-9_-]+$/.test(part)) {
          throw new Error('Invalid character in token part');
        }
      });
      
      // Try to decode payload (just check if valid base64)
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      
      // Check for suspicious payload
      if (payload.iss && payload.iss.length > 500) {
        this.logSuspiciousActivity(ip, 'SUSPICIOUS_ISSUER', { issuerLength: payload.iss.length });
        return false;
      }
      
    } catch (error) {
      this.logSuspiciousActivity(ip, 'INVALID_TOKEN_ENCODING', { error: error.message });
      return false;
    }

    return true;
  }

  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  // Clean up old blocks (call this periodically)
  cleanupBlocks() {
    // For simplicity, we'll keep blocks for 24 hours
    // In production, you'd want to persist this
    setInterval(() => {
      this.blockedIPs.clear();
      this.suspiciousActivities.clear();
      console.log('🧹 Security monitor cache cleared');
    }, 24 * 60 * 60 * 1000);
  }
}

// Initialize security monitor
const securityMonitor = new SecurityMonitor();
securityMonitor.cleanupBlocks();

// ==================== SOCKET.IO SETUP WITH AUTHENTICATION ====================
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB max message size
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  allowEIO3: true
});

// Socket.io middleware for authentication
io.use((socket, next) => {
  const clientIp = socket.handshake.address;
  
  // Check if IP is blocked
  if (securityMonitor.isBlocked(clientIp)) {
    console.warn(`🚫 Blocked connection attempt from blocked IP: ${clientIp}`);
    return next(new Error('Access denied'));
  }

  const token = socket.handshake.auth.token || socket.handshake.query.token;

  // Validate token format
  if (!securityMonitor.checkToken(token, clientIp)) {
    return next(new Error('Invalid token format'));
  }

  if (!token) {
    // Allow unauthenticated connections for public data
    socket.user = null;
    return next();
  }

  try {
    // Verify the token properly
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check for suspicious payload
    if (decoded.iss && decoded.iss.length > 500) {
      securityMonitor.logSuspiciousActivity(clientIp, 'SUSPICIOUS_ISSUER_PAYLOAD', { 
        issuerLength: decoded.iss.length 
      });
      return next(new Error('Invalid token payload'));
    }

    socket.user = decoded;
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      securityMonitor.logSuspiciousActivity(clientIp, 'INVALID_TOKEN_SIGNATURE', { 
        error: error.message 
      });
      return next(new Error('Invalid token signature'));
    }
    securityMonitor.logSuspiciousActivity(clientIp, 'TOKEN_VERIFICATION_FAILED', { 
      error: error.message 
    });
    return next(new Error('Authentication failed'));
  }
});

// Socket.io connection handler with rate limiting
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`🔌 Client connected: ${socket.id} from ${clientIp}`);

  // Rate limiting per socket
  socket.messageCount = 0;
  socket.messageResetTime = Date.now() + 60000; // Reset every minute

  // Message rate limiting middleware
  socket.use(([event, ...args], next) => {
    const now = Date.now();
    
    if (now > socket.messageResetTime) {
      socket.messageCount = 0;
      socket.messageResetTime = now + 60000;
    }
    
    if (socket.messageCount > 100) { // Max 100 messages per minute
      securityMonitor.logSuspiciousActivity(clientIp, 'RATE_LIMIT_EXCEEDED', { 
        messageCount: socket.messageCount 
      });
      return next(new Error('Rate limit exceeded'));
    }
    
    socket.messageCount++;
    next();
  });

  // Handle authentication event
  socket.on('authenticate', (token) => {
    try {
      if (!securityMonitor.checkToken(token, clientIp)) {
        socket.emit('authenticated', { success: false, error: 'Invalid token format' });
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.join(`user-${decoded.userId}`);
      socket.userId = decoded.userId;
      socket.emit('authenticated', { success: true });
      
      console.log(`✅ Socket ${socket.id} authenticated as user ${decoded.userId}`);
    } catch (error) {
      securityMonitor.logSuspiciousActivity(clientIp, 'AUTHENTICATION_FAILED', { 
        error: error.message 
      });
      socket.emit('authenticated', { success: false, error: error.message });
    }
  });

  // Price update interval with error handling
  const priceInterval = setInterval(() => {
    try {
      const markets = ['BTC', 'ETH', 'BNB', 'SOL'].map(symbol => ({
        symbol: `${symbol}/USD`,
        price: 50000 + Math.random() * 2000,
        change: (Math.random() - 0.5) * 5
      }));
      socket.emit('price-update', markets);
    } catch (error) {
      console.error('Price update error:', error);
    }
  }, 5000);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    clearInterval(priceInterval);
    console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
    securityMonitor.logSuspiciousActivity(clientIp, 'SOCKET_ERROR', { 
      error: error.message 
    });
  });
});

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5500',
  'https://fanciful-duckanoo-7072a6.netlify.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
       callback(null, true);
    } else {
       callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Request size limiting
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// IP blocking middleware
app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (securityMonitor.isBlocked(clientIp)) {
    console.warn(`🚫 Blocked request from blocked IP: ${clientIp}`);
    return res.status(403).json({ 
      status: 'error', 
      message: 'Access denied' 
    });
  }
  
  next();
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // stricter limit for auth routes
  message: { status: 'error', message: 'Too many authentication attempts, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);

// ==================== IMPORT ROUTES ====================
const authRoutes = require('./api/auth');
const userRoutes = require('./api/users');
const cardRoutes = require('./api/cards');
const cryptoRoutes = require('./api/crypto');
const investmentRoutes = require('./api/investments');
const loanRoutes = require('./api/loans');
const mobileMoneyRoutes = require('./api/mobileMoney');
const adminRoutes = require('./api/admin');
const bankingRoutes = require('./api/banking');

// ==================== USE ROUTES ====================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/cards', cardRoutes);
app.use('/api/v1/crypto', cryptoRoutes);
app.use('/api/v1/investments', investmentRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/mobile-money', mobileMoneyRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/banking', bankingRoutes);

// ==================== MongoDB Connection ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quantumpay', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ==================== TOKEN REFRESH ENDPOINT ====================
app.post('/api/v1/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ status: 'error', message: 'Refresh token required' });
    }

    // Verify refresh token (implement your refresh token logic)
    // This is a simplified example - in production, use refresh tokens stored in database
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET + '-refresh');
      
      // Generate new access token
      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ 
        status: 'success',
        token: newToken,
        expiresIn: 604800 // 7 days in seconds
      });
      
    } catch (error) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ status: 'error', message: 'Token refresh failed' });
  }
});

// ==================== MIDDLEWARE ====================
const authenticate = async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }

    // Validate token format
    if (!securityMonitor.checkToken(token, clientIp)) {
      return res.status(401).json({ status: 'error', message: 'Invalid token format' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'error', message: 'Invalid token signature' });
    }
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

// ==================== UTILITY FUNCTIONS ====================
const generateAccountNumber = () => {
  return 'ACC' + Date.now() + Math.random().toString(36).substring(2, 10).toUpperCase();
};

const generateReference = () => {
  return 'TXN' + Date.now() + Math.random().toString(36).substring(2, 10).toUpperCase();
};

const generateCardNumber = () => {
  return '4' + Math.random().toString().slice(2, 15).padEnd(15, '0');
};

const logActivity = async (userId, action, details, req) => {
  try {
    await ActivityLog.create({
      userId,
      action,
      details,
      ip: req?.ip,
      userAgent: req?.get('user-agent')
    });
  } catch (error) {
    console.error('Activity log error:', error);
  }
};

// ==================== AUTH ROUTES ====================

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, country, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'User with this email or phone already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = 'REF' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      country,
      password: hashedPassword,
      referralCode
    });

    await user.save();

    // Create accounts
    const currencies = ['USD', 'EUR', 'GBP', 'KES'];
    for (const currency of currencies) {
      await Account.create({
        userId: user._id,
        currency,
        balance: currency === 'USD' ? 1000 : 0,
        accountNumber: generateAccountNumber(),
        accountType: 'savings'
      });
    }

    // Create crypto wallets
    const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA'];
    for (const crypto of cryptos) {
      await Staking.create({
        userId: user._id,
        currency: crypto,
        amount: 0,
        apy: crypto === 'BTC' ? 2.5 : 5.0,
        status: 'active'
      });
    }

    // Create reward account
    await Reward.create({
      userId: user._id,
      points: 100,
      cashback: 0,
      tier: 'bronze'
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    await logActivity(user._id, 'REGISTER', 'User registered', req);

    res.status(201).json({
      status: 'success',
      token,
      data: { user: { ...user.toObject(), password: undefined } }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    await logActivity(user._id, 'LOGIN', 'User logged in', req);

    res.json({
      status: 'success',
      token,
      data: { user: { ...user.toObject(), password: undefined } }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Login failed' });
  }
});

// Add this after the login route
app.post('/api/v1/auth/verify', authenticate, async (req, res) => {
  try {
    res.json({ 
      status: 'success', 
      data: { user: { ...req.user.toObject(), password: undefined } } 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Verification failed' });
  }
});

// Add this after verify route
app.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // In production, send actual email here
    res.json({ 
      status: 'success', 
      message: 'Password reset link sent to your email' 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to process request' });
  }
});

// ==================== USER ROUTES ====================

app.get('/api/v1/users/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json({ status: 'success', data: { user } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user' });
  }
});

app.get('/api/v1/users/balance', authenticate, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.userId, isActive: true });
    const staking = await Staking.find({ userId: req.userId, status: 'active' });
    const investments = await Investment.find({ userId: req.userId, status: 'active' });
    
    const rates = { USD: 1, EUR: 1.08, GBP: 1.26, KES: 0.0067, BTC: 51234.50, ETH: 3123.45, BNB: 412.75, SOL: 123.45, ADA: 0.45 };
    
    let totalUSD = 0;
    const balances = {};
    const crypto = {};

    accounts.forEach(acc => {
      balances[acc.currency] = acc.balance;
      totalUSD += acc.balance * (rates[acc.currency] || 1);
    });

    staking.forEach(s => {
      crypto[s.currency] = (crypto[s.currency] || 0) + s.amount;
      totalUSD += s.amount * (rates[s.currency] || 0);
    });

    investments.forEach(inv => {
      totalUSD += inv.amount * (rates[inv.currency] || 1);
    });

    res.json({
      status: 'success',
      data: { balances, crypto, investments, totalUSD }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch balances' });
  }
});

// ==================== TRANSACTION ROUTES ====================

app.get('/api/v1/users/transactions', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type = 'all' } = req.query;
    const query = { userId: req.userId };
    
    if (type !== 'all') {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      status: 'success',
      data: { transactions, total, limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
  }
});

app.post('/api/v1/transactions/send', authenticate, async (req, res) => {
  try {
    const { toAddress, amount, currency, type, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid amount' });
    }

    const fromAccount = await Account.findOne({ 
      userId: req.userId, 
      currency,
      isActive: true 
    });

    if (!fromAccount || fromAccount.balance < amount) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const fee = amount * 0.01;
    const total = amount + fee;

    if (fromAccount.balance < total) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance including fees' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      fromAccount.balance -= total;
      await fromAccount.save({ session });

      const transaction = new Transaction({
        userId: req.userId,
        type: 'send',
        amount,
        currency,
        toAddress,
        fromAccount: fromAccount._id,
        status: 'completed',
        description,
        reference: generateReference(),
        fee
      });

      await transaction.save({ session });
      await session.commitTransaction();

      io.to(`user-${req.userId}`).emit('balance-update', {
        currency,
        newBalance: fromAccount.balance
      });

      io.to(`user-${req.userId}`).emit('transaction', transaction);

      await logActivity(req.userId, 'SEND_MONEY', `Sent ${amount} ${currency} to ${toAddress}`, req);

      res.json({
        status: 'success',
        data: { transaction, newBalance: fromAccount.balance }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Send money error:', error);
    res.status(500).json({ status: 'error', message: 'Transaction failed' });
  }
});

// ==================== CARD ROUTES ====================

app.get('/api/v1/cards', authenticate, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.userId });
    res.json({ status: 'success', data: { cards } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch cards' });
  }
});

app.post('/api/v1/cards/create', authenticate, async (req, res) => {
  try {
    const { type, accountId } = req.body;

    const account = await Account.findOne({ _id: accountId, userId: req.userId });
    if (!account) {
      return res.status(400).json({ status: 'error', message: 'Invalid account' });
    }

    const cardNumber = generateCardNumber();
    const expiryMonth = ('0' + (new Date().getMonth() + 1)).slice(-2);
    const expiryYear = (new Date().getFullYear() + 3).toString();
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const card = new Card({
      userId: req.userId,
      accountId,
      cardNumber,
      cardHolderName: `${req.user.firstName} ${req.user.lastName}`.toUpperCase(),
      expiryMonth,
      expiryYear,
      cvv,
      type,
      brand: 'visa',
      limit: type === 'virtual' ? 5000 : 10000,
      spent: 0
    });

    await card.save();

    await logActivity(req.userId, 'CREATE_CARD', `Created ${type} card`, req);

    res.json({
      status: 'success',
      data: { card: { ...card.toObject(), cardNumber: `**** **** **** ${cardNumber.slice(-4)}` } }
    });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create card' });
  }
});

// ==================== LOAN ROUTES ====================

app.get('/api/v1/loans', authenticate, async (req, res) => {
  try {
    const loans = await Loan.find({ userId: req.userId });
    res.json({ status: 'success', data: { loans } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch loans' });
  }
});

app.post('/api/v1/loans/apply', authenticate, async (req, res) => {
  try {
    const { amount, currency, term } = req.body;

    const interestRate = 5.5;
    const totalInterest = amount * (interestRate / 100) * (term / 12);
    const totalAmount = amount + totalInterest;
    const monthlyPayment = totalAmount / term;

    const loan = new Loan({
      userId: req.userId,
      amount,
      currency,
      remainingAmount: totalAmount,
      interestRate,
      term,
      status: 'pending',
      nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await loan.save();

    await logActivity(req.userId, 'APPLY_LOAN', `Applied for ${amount} ${currency} loan`, req);

    res.json({
      status: 'success',
      data: { loan, monthlyPayment, totalInterest, totalAmount }
    });
  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({ status: 'error', message: 'Loan application failed' });
  }
});

// ==================== INVESTMENT ROUTES ====================

app.get('/api/v1/investments', authenticate, async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId });
    res.json({ status: 'success', data: { investments } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch investments' });
  }
});

app.post('/api/v1/investments/buy', authenticate, async (req, res) => {
  try {
    const { type, symbol, name, amount, quantity, price, currency } = req.body;

    const account = await Account.findOne({ userId: req.userId, currency });
    if (!account || account.balance < amount) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      account.balance -= amount;
      await account.save({ session });

      const investment = new Investment({
        userId: req.userId,
        type,
        symbol,
        name,
        amount,
        quantity,
        purchasePrice: price,
        currentPrice: price,
        currency,
        status: 'active'
      });

      await investment.save({ session });

      const transaction = new Transaction({
        userId: req.userId,
        type: 'exchange',
        amount,
        currency,
        description: `Bought ${quantity} ${symbol}`,
        reference: generateReference(),
        status: 'completed'
      });

      await transaction.save({ session });
      await session.commitTransaction();

      io.to(`user-${req.userId}`).emit('balance-update', { currency, newBalance: account.balance });

      await logActivity(req.userId, 'BUY_INVESTMENT', `Bought ${quantity} ${symbol}`, req);

      res.json({ status: 'success', data: { investment, transaction } });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Investment purchase error:', error);
    res.status(500).json({ status: 'error', message: 'Purchase failed' });
  }
});

// ==================== STAKING ROUTES ====================

app.get('/api/v1/staking', authenticate, async (req, res) => {
  try {
    const staking = await Staking.find({ userId: req.userId });
    res.json({ status: 'success', data: { staking } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch staking' });
  }
});

app.post('/api/v1/staking/stake', authenticate, async (req, res) => {
  try {
    const { currency, amount, lockPeriod } = req.body;

    const account = await Account.findOne({ userId: req.userId, currency });
    if (!account || account.balance < amount) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const apyRates = { BTC: 2.5, ETH: 4.5, BNB: 6.8, SOL: 8.2, ADA: 3.2, DOT: 12.5 };
    const apy = apyRates[currency] || 5.0;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      account.balance -= amount;
      await account.save({ session });

      const staking = new Staking({
        userId: req.userId,
        currency,
        amount,
        apy,
        lockPeriod,
        startDate: new Date(),
        endDate: new Date(Date.now() + lockPeriod * 24 * 60 * 60 * 1000),
        rewards: 0,
        status: 'active'
      });

      await staking.save({ session });

      const transaction = new Transaction({
        userId: req.userId,
        type: 'exchange',
        amount,
        currency,
        description: `Staked ${amount} ${currency}`,
        reference: generateReference(),
        status: 'completed'
      });

      await transaction.save({ session });
      await session.commitTransaction();

      io.to(`user-${req.userId}`).emit('balance-update', { currency, newBalance: account.balance });

      await logActivity(req.userId, 'STAKE', `Staked ${amount} ${currency}`, req);

      res.json({ status: 'success', data: { staking, transaction } });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Staking error:', error);
    res.status(500).json({ status: 'error', message: 'Staking failed' });
  }
});

// ==================== NFT ROUTES ====================

app.get('/api/v1/nft', authenticate, async (req, res) => {
  try {
    const nfts = await NFT.find({ userId: req.userId });
    res.json({ status: 'success', data: { nfts } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch NFTs' });
  }
});

// ==================== BUSINESS ROUTES ====================

app.get('/api/v1/business', authenticate, async (req, res) => {
  try {
    const business = await BusinessAccount.findOne({ userId: req.userId });
    res.json({ status: 'success', data: { business } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch business account' });
  }
});

app.post('/api/v1/business/create', authenticate, async (req, res) => {
  try {
    const { businessName, businessType, registrationNumber, taxId, address } = req.body;

    const business = new BusinessAccount({
      userId: req.userId,
      businessName,
      businessType,
      registrationNumber,
      taxId,
      address,
      balance: 0,
      currency: 'USD'
    });

    await business.save();

    await logActivity(req.userId, 'CREATE_BUSINESS', `Created business account: ${businessName}`, req);

    res.json({ status: 'success', data: { business } });
  } catch (error) {
    console.error('Business creation error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create business account' });
  }
});

// ==================== INVOICE ROUTES ====================

app.get('/api/v1/invoices', authenticate, async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.userId });
    res.json({ status: 'success', data: { invoices } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch invoices' });
  }
});

app.post('/api/v1/invoices/create', authenticate, async (req, res) => {
  try {
    const { clientName, clientEmail, clientAddress, items, tax, currency, dueDate } = req.body;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxAmount = subtotal * (tax / 100);
    const total = subtotal + taxAmount;

    const invoiceNumber = 'INV-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const invoice = new Invoice({
      userId: req.userId,
      invoiceNumber,
      clientName,
      clientEmail,
      clientAddress,
      items,
      subtotal,
      tax: taxAmount,
      total,
      currency,
      dueDate,
      status: 'draft'
    });

    await invoice.save();

    await logActivity(req.userId, 'CREATE_INVOICE', `Created invoice ${invoiceNumber}`, req);

    res.json({ status: 'success', data: { invoice } });
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create invoice' });
  }
});

// ==================== REWARD ROUTES ====================

app.get('/api/v1/rewards', authenticate, async (req, res) => {
  try {
    let reward = await Reward.findOne({ userId: req.userId });
    
    if (!reward) {
      reward = await Reward.create({
        userId: req.userId,
        points: 100,
        cashback: 0,
        tier: 'bronze'
      });
    }

    res.json({ status: 'success', data: { reward } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch rewards' });
  }
});

// ==================== REFERRAL ROUTES ====================

app.get('/api/v1/referrals', authenticate, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrerId: req.userId })
      .populate('referredId', 'firstName lastName email');

    const stats = {
      total: referrals.length,
      verified: referrals.filter(r => r.status === 'verified').length,
      pending: referrals.filter(r => r.status === 'pending').length,
      earned: referrals.reduce((sum, r) => sum + r.earnedAmount, 0)
    };

    res.json({
      status: 'success',
      data: { referrals, stats, referralCode: req.user.referralCode }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch referrals' });
  }
});

// ==================== MARKET ROUTES ====================

app.get('/api/v1/markets/prices', authenticate, async (req, res) => {
  try {
    const markets = [
      { symbol: 'BTC/USD', name: 'Bitcoin', price: 51234.50, change: 2.5, volume: 28500000000, high: 51800, low: 50500 },
      { symbol: 'ETH/USD', name: 'Ethereum', price: 3123.45, change: 1.8, volume: 15400000000, high: 3150, low: 3080 },
      { symbol: 'BNB/USD', name: 'Binance Coin', price: 412.75, change: -0.5, volume: 3200000000, high: 418, low: 410 },
      { symbol: 'SOL/USD', name: 'Solana', price: 123.45, change: 5.2, volume: 1800000000, high: 125, low: 118 },
      { symbol: 'ADA/USD', name: 'Cardano', price: 0.45, change: -1.2, volume: 850000000, high: 0.46, low: 0.44 },
      { symbol: 'DOT/USD', name: 'Polkadot', price: 7.50, change: 2.8, volume: 420000000, high: 7.60, low: 7.30 },
      { symbol: 'AAPL', name: 'Apple Inc.', price: 175.50, change: 0.8, volume: 45000000, type: 'stock' },
      { symbol: 'GOOGL', name: 'Alphabet', price: 142.30, change: 1.2, volume: 32000000, type: 'stock' },
      { symbol: 'TSLA', name: 'Tesla', price: 245.60, change: -2.1, volume: 89000000, type: 'stock' },
      { symbol: 'SPY', name: 'S&P 500 ETF', price: 478.20, change: 0.3, volume: 62000000, type: 'etf' }
    ];

    res.json({ status: 'success', data: { markets } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch market data' });
  }
});

// ==================== DEVICE ROUTES ====================

app.get('/api/v1/devices', authenticate, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.userId }).sort({ lastActive: -1 });
    res.json({ status: 'success', data: { devices } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch devices' });
  }
});

app.post('/api/v1/devices/logout', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (deviceId === 'all') {
      await Device.updateMany(
        { userId: req.userId, isCurrent: false },
        { $set: { lastActive: new Date() } }
      );
    } else {
      await Device.updateOne(
        { _id: deviceId, userId: req.userId },
        { $set: { lastActive: new Date() } }
      );
    }

    await logActivity(req.userId, 'LOGOUT_DEVICES', 'Logged out from devices', req);

    res.json({ status: 'success', message: 'Devices logged out' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to logout devices' });
  }
});

// ==================== ACTIVITY ROUTES ====================

app.get('/api/v1/activities', authenticate, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const activities = await ActivityLog.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ status: 'success', data: { activities } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch activities' });
  }
});

// ==================== SECURITY ROUTES ====================

app.post('/api/v1/security/2fa/enable', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.twoFactorEnabled = true;
    await user.save();

    await logActivity(req.userId, 'ENABLE_2FA', 'Enabled two-factor authentication', req);

    res.json({ status: 'success', message: '2FA enabled' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to enable 2FA' });
  }
});

app.post('/api/v1/security/password/change', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logActivity(req.userId, 'CHANGE_PASSWORD', 'Changed password', req);

    res.json({ status: 'success', message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
});

// ==================== SETTINGS ROUTES ====================

app.put('/api/v1/settings', authenticate, async (req, res) => {
  try {
    const { defaultCurrency, language, timezone, notifications } = req.body;

    const user = await User.findById(req.userId);
    user.settings = { defaultCurrency, language, timezone, notifications };
    await user.save();

    await logActivity(req.userId, 'UPDATE_SETTINGS', 'Updated settings', req);

    res.json({ status: 'success', data: { settings: user.settings } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update settings' });
  }
});

// ==================== PROFILE ROUTES ====================

app.put('/api/v1/profile', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone, country } = req.body;

    const user = await User.findById(req.userId);
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;
    user.country = country || user.country;
    await user.save();

    await logActivity(req.userId, 'UPDATE_PROFILE', 'Updated profile', req);

    res.json({ status: 'success', data: { user: { ...user.toObject(), password: undefined } } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update profile' });
  }
});

// ==================== NOTIFICATION ROUTES ====================

app.get('/api/v1/notifications', authenticate, async (req, res) => {
  try {
    const notifications = [
      { id: 1, title: 'Welcome Bonus', message: 'You received $100 welcome bonus', read: false, date: new Date() },
      { id: 2, title: 'Security Alert', message: 'New login from Chrome on Windows', read: true, date: new Date(Date.now() - 86400000) }
    ];

    res.json({ status: 'success', data: { notifications } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch notifications' });
  }
});

// ==================== STATS ROUTES ====================

app.get('/api/v1/stats/portfolio', authenticate, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.userId });
    const staking = await Staking.find({ userId: req.userId });
    const investments = await Investment.find({ userId: req.userId });

    const rates = { USD: 1, BTC: 51234.50, ETH: 3123.45, BNB: 412.75, SOL: 123.45 };

    const totalFiat = accounts.reduce((sum, a) => sum + a.balance, 0);
    const totalCrypto = staking.reduce((sum, s) => sum + (s.amount * (rates[s.currency] || 0)), 0);
    const totalInvestments = investments.reduce((sum, i) => sum + i.amount, 0);

    const portfolio = {
      total: totalFiat + totalCrypto + totalInvestments,
      fiat: totalFiat,
      crypto: totalCrypto,
      investments: totalInvestments
    };

    res.json({ status: 'success', data: { portfolio } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch portfolio stats' });
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    connections: io.engine?.clientsCount || 0,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  
  // Log suspicious errors
  if (err.message && err.message.includes('token')) {
    securityMonitor.logSuspiciousActivity(req.ip, 'ERROR_TOKEN_ISSUE', { 
      error: err.message 
    });
  }
  
  res.status(500).json({ 
    status: 'error', 
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`🔒 Security monitor active`);
  console.log(`🌐 Allowed origins:`, allowedOrigins);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing connections...');
  io.close(() => {
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing connections...');
  io.close(() => {
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  });
});