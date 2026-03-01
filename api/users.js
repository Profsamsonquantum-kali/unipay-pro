const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect } = require('../../middleware/auth');

router.use(protect); // All routes below require authentication

router.get('/me', userController.getMe);
router.patch('/update-me', userController.updateMe);
router.delete('/delete-me', userController.deleteMe);
router.get('/transactions', userController.getMyTransactions);
router.get('/balance', userController.getBalance);

module.exports = router;