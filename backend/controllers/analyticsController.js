const prisma = require('../database/prisma');
const logger = require('../utils/logger');

const analyticsController = {
  async getAnalytics(req, res) {
    try {
      // 1. Total reports
      const totalCount = await prisma.incidentReport.count();

      // 2. Average rating
      const avgRatingResult = await prisma.feedback.aggregate({
        _avg: { rating_stars: true }
      });
      const avgRating = avgRatingResult._avg.rating_stars ? parseFloat(avgRatingResult._avg.rating_stars.toFixed(2)) : 0;

      // 3. Average response time
      const avgTimeResult = await prisma.incidentReport.aggregate({
        _avg: { response_time_ms: true }
      });
      const avgTime = avgTimeResult._avg.response_time_ms ? Math.round(avgTimeResult._avg.response_time_ms) : 0;

      // 4. Severity distribution
      const severityGroups = await prisma.incidentReport.groupBy({
        by: ['severity'],
        _count: { id: true }
      });
      const severityMap = { Low: 0, Medium: 0, High: 0, Critical: 0 };
      severityGroups.forEach(g => {
        if (severityMap[g.severity] !== undefined) {
          severityMap[g.severity] = g._count.id;
        }
      });

      // 5. Rating distribution
      const ratingGroups = await prisma.feedback.groupBy({
        by: ['rating_stars'],
        _count: { id: true }
      });
      const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratingGroups.forEach(g => {
        if (ratingMap[g.rating_stars] !== undefined) {
          ratingMap[g.rating_stars] = g._count.id;
        }
      });

      // 6. Top locations
      const locationGroups = await prisma.incidentReport.groupBy({
        by: ['location'],
        _count: { id: true }
      });
      const topLocations = locationGroups
        .map(g => ({
          site_location: g.location,
          count: g._count.id
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 7. Recent feedback trends
      const recentFeedbacks = await prisma.feedback.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        include: { report: true }
      });
      const trends = recentFeedbacks.map(f => ({
        created_at: f.report.created_at,
        rating_stars: f.rating_stars
      })).reverse();

      res.json({
        total_generations: totalCount,
        average_rating: avgRating,
        average_response_time_ms: avgTime,
        severity_distribution: severityMap,
        rating_distribution: ratingMap,
        top_locations: topLocations,
        recent_feedback_trends: trends
      });
    } catch (err) {
      logger.error('Failed to compute analytics', err);
      res.status(500).json({ error: 'Failed to compute analytics: ' + err.message });
    }
  }
};

module.exports = analyticsController;
