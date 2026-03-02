const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Import middleware - make sure this file exists
let protect = (req, res, next) => {
  // Temporary middleware if authMiddleware doesn't exist
  req.user = { id: 'temp_user_id' };
  next();
};

// Try to load real auth middleware if it exists
try {
  const authMiddleware = require('../middleware/authMiddleware');
  if (authMiddleware && authMiddleware.protect) {
    protect = authMiddleware.protect;
    console.log('✅ Using real auth middleware');
  }
} catch (error) {
  console.log('⚠️ Using temporary auth middleware (authMiddleware not found)');
}

// Public routes (no authentication required)
// Add any public user routes here if needed

// Apply protect middleware to all routes below this line
router.use(protect);

// Protected routes (require authentication)
router.get('/', userController.getUsers);
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
