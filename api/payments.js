// api/payments.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Payments API working' });
});

module.exports = router;
