const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const requireAuth = require('../utils/authMiddleware');

router.get('/', requireAuth, analyticsController.getAnalytics);

module.exports = router;
