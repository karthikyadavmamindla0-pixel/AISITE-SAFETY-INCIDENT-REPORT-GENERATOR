const prisma = require('../database/prisma');
const logger = require('../utils/logger');
const { generateShortId } = require('../utils/helpers');

const feedbackController = {
  async submitFeedback(req, res) {
    const { report_id, rating_stars, comments } = req.body;
    if (!report_id || !rating_stars) {
      return res.status(400).json({ error: 'Missing report ID or star rating.' });
    }

    try {
      // Check if report exists
      const report = await prisma.incidentReport.findUnique({
        where: { id: report_id }
      });
      if (!report) {
        return res.status(404).json({ error: 'Report not found.' });
      }

      const feedbackId = 'fb-' + generateShortId();

      // Delete existing feedback if any for this report
      await prisma.feedback.deleteMany({
        where: { report_id }
      });

      // Insert new feedback
      const feedback = await prisma.feedback.create({
        data: {
          id: feedbackId,
          report_id,
          rating_stars: parseInt(rating_stars),
          comments: comments || null
        }
      });

      res.status(201).json({ success: true, id: feedbackId });
    } catch (err) {
      logger.error('Failed to submit feedback', err);
      res.status(500).json({ error: 'Failed to submit feedback: ' + err.message });
    }
  }
};

module.exports = feedbackController;
