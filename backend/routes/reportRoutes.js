const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const requireAuth = require('../utils/authMiddleware');

router.post('/', requireAuth, reportController.createReport); // Handles POST /api/report
router.get('/', requireAuth, reportController.getAllReports); // Handles GET /api/reports
router.get('/:id', requireAuth, reportController.getReportById); // Handles GET /api/reports/:id
router.put('/:id', requireAuth, reportController.updateReport); // Handles PUT /api/reports/:id
router.delete('/:id', requireAuth, reportController.deleteReport); // Handles DELETE /api/reports/:id

module.exports = router;
