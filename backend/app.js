const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const templateRoutes = require('./routes/templateRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Serve frontend static assets from 'static' folder
app.use(express.static(path.join(__dirname, 'static')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/report', reportRoutes);  // Maps to createReport
app.use('/api/reports', reportRoutes); // Maps to getAllReports, getReportById, updateReport, deleteReport
app.use('/api/templates', templateRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-safety-incident-report-generator' });
});

// Fallback: serve index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', err);
  res.status(500).json({ error: 'Internal Server Error: ' + err.message });
});

module.exports = app;
