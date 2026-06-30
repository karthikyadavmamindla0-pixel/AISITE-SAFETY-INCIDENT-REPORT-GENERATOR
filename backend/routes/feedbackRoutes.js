const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const requireAuth = require('../utils/authMiddleware');

router.post('/', requireAuth, feedbackController.submitFeedback);

module.exports = router;
