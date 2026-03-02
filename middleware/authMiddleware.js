// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ 
          status: 'error', 
          message: 'User not found' 
        });
      }

      next();
    } catch (error) {
      console.error('Auth error:', error.message);
      return res.status(401).json({ 
        status: 'error', 
        message: 'Not authorized - invalid token' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      status: 'error', 
      message: 'Not authorized - no token provided' 
    });
  }
};

module.exports = { protect };
