const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const requireAuth = require('../utils/authMiddleware');

router.get('/', requireAuth, templateController.getTemplates);

module.exports = router;
