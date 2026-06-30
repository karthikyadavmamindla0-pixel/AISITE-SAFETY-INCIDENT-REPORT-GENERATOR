const prisma = require('../database/prisma');
const { generateShortId } = require('../utils/helpers');
const { generateAIReport } = require('../services/aiService');
const { generatePDF, deletePDF } = require('../services/pdfService');
const logger = require('../utils/logger');

const reportController = {
  // Create / Generate Report
  async createReport(req, res) {
    const startTime = Date.now();
    const {
      supervisor_name,
      supervisor_role,
      site_location,
      location,
      incident_timestamp,
      incident_date,
      incident_type,
      incident_title,
      severity_level,
      severity,
      raw_description,
      incident_description,
      weather_conditions,
      immediate_actions,
      witness_details
    } = req.body;

    // Resolve field mappings (support both existing front-end payload and standard database naming)
    const name = supervisor_name;
    const role = supervisor_role || '';
    const loc = site_location || location;
    const date = incident_timestamp || incident_date;
    const title = incident_type || incident_title;
    const sev = severity_level || severity;
    const desc = raw_description || incident_description;

    // Backend Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supervisor name is required.' });
    }
    if (!loc || !loc.trim()) {
      return res.status(400).json({ error: 'Location/site is required.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Incident date/time is required.' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Incident classification/title is required.' });
    }
    if (!sev) {
      return res.status(400).json({ error: 'Severity rating is required.' });
    }
    if (!desc || desc.trim().length < 15) {
      return res.status(400).json({ error: 'Incident description must be at least 15 characters long.' });
    }

    try {
      // 1. Generate AI report (Markdown)
      const inputs = {
        supervisor_name: name,
        supervisor_role: role,
        site_location: loc,
        incident_timestamp: date,
        incident_type: title,
        severity_level: sev,
        raw_description: desc,
        weather_conditions,
        immediate_actions,
        witness_details
      };

      const { reportMarkdown, isMock } = await generateAIReport(inputs);
      const responseTimeMs = Date.now() - startTime;
      const reportId = 'rep-' + generateShortId();

      // 2. Generate PDF server-side and save to static folder
      let pdfFilename = null;
      try {
        pdfFilename = await generatePDF(reportId, reportMarkdown);
      } catch (pdfErr) {
        logger.error('Failed to generate PDF during report creation', pdfErr);
      }

      // 3. Save to database using Prisma
      const report = await prisma.incidentReport.create({
        data: {
          id: reportId,
          supervisor_name: name,
          supervisor_role: role || null,
          incident_title: title,
          location: loc,
          incident_date: date,
          severity: sev,
          incident_description: desc,
          weather_conditions: weather_conditions || null,
          immediate_actions: immediate_actions || null,
          witness_details: witness_details || null,
          ai_generated_report: reportMarkdown,
          pdf_filename: pdfFilename,
          response_time_ms: responseTimeMs
        }
      });

      res.status(201).json({
        id: report.id,
        generated_report_markdown: report.ai_generated_report,
        response_time_ms: report.response_time_ms,
        is_mock: isMock,
        pdf_filename: report.pdf_filename
      });

    } catch (err) {
      logger.error('Failed to generate and save safety report', err);
      res.status(500).json({ error: 'Failed to generate safety incident report: ' + err.message });
    }
  },

  // Get All Reports (supports searching, filtering, and sorting)
  async getAllReports(req, res) {
    try {
      const { search, severity, sort } = req.query;
      
      let where = {};
      
      // Filter by Search Query
      if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
          { incident_title: { contains: query } },
          { supervisor_name: { contains: query } },
          { location: { contains: query } }
        ];
      }
      
      // Filter by Severity
      if (severity && severity !== 'ALL') {
        where.severity = severity;
      }
      
      // Sort Order
      let orderBy = { created_at: 'desc' };
      if (sort === 'oldest') {
        orderBy = { created_at: 'asc' };
      }

      const reports = await prisma.incidentReport.findMany({
        where,
        orderBy,
        include: {
          feedbacks: {
            select: { rating_stars: true }
          }
        }
      });

      // Map feedbacks to matching frontend expectation of rating_stars
      const mappedReports = reports.map(r => {
        const rating = r.feedbacks && r.feedbacks.length > 0 ? r.feedbacks[0].rating_stars : null;
        return {
          id: r.id,
          supervisor_name: r.supervisor_name,
          supervisor_role: r.supervisor_role,
          incident_title: r.incident_title, // For history lists
          incident_type: r.incident_title,  // Fallback map
          location: r.location,
          site_location: r.location,         // Fallback map
          incident_date: r.incident_date,
          incident_timestamp: r.incident_date, // Fallback map
          severity: r.severity,
          severity_level: r.severity,          // Fallback map
          incident_description: r.incident_description,
          raw_description: r.incident_description, // Fallback map
          weather_conditions: r.weather_conditions,
          immediate_actions: r.immediate_actions,
          witness_details: r.witness_details,
          ai_generated_report: r.ai_generated_report,
          generated_report_markdown: r.ai_generated_report, // Fallback map
          pdf_filename: r.pdf_filename,
          rating_stars: rating,
          created_at: r.created_at
        };
      });

      res.json(mappedReports);
    } catch (err) {
      logger.error('Failed to retrieve reports list', err);
      res.status(500).json({ error: 'Failed to retrieve safety register: ' + err.message });
    }
  },

  // Get Single Report
  async getReportById(req, res) {
    try {
      const report = await prisma.incidentReport.findUnique({
        where: { id: req.params.id },
        include: {
          feedbacks: true
        }
      });

      if (!report) {
        return res.status(404).json({ error: 'Incident report not found.' });
      }

      const feedback = report.feedbacks && report.feedbacks.length > 0 ? {
        rating_stars: report.feedbacks[0].rating_stars,
        comments: report.feedbacks[0].comments
      } : null;

      const responseObj = {
        id: report.id,
        supervisor_name: report.supervisor_name,
        supervisor_role: report.supervisor_role,
        incident_title: report.incident_title,
        incident_type: report.incident_title,
        location: report.location,
        site_location: report.location,
        incident_date: report.incident_date,
        incident_timestamp: report.incident_date,
        severity: report.severity,
        severity_level: report.severity,
        incident_description: report.incident_description,
        raw_description: report.incident_description,
        weather_conditions: report.weather_conditions,
        immediate_actions: report.immediate_actions,
        witness_details: report.witness_details,
        ai_generated_report: report.ai_generated_report,
        generated_report_markdown: report.ai_generated_report,
        pdf_filename: report.pdf_filename,
        response_time_ms: report.response_time_ms,
        created_at: report.created_at,
        feedback: feedback
      };

      res.json(responseObj);
    } catch (err) {
      logger.error(`Failed to retrieve report ${req.params.id}`, err);
      res.status(500).json({ error: 'Failed to fetch report details: ' + err.message });
    }
  },

  // Update Report
  async updateReport(req, res) {
    const { id } = req.params;
    const {
      supervisor_name,
      supervisor_role,
      location,
      site_location,
      incident_date,
      incident_timestamp,
      incident_title,
      incident_type,
      severity,
      severity_level,
      incident_description,
      raw_description,
      weather_conditions,
      immediate_actions,
      witness_details,
      ai_generated_report,
      generated_report_markdown
    } = req.body;

    try {
      const existing = await prisma.incidentReport.findUnique({
        where: { id }
      });
      if (!existing) {
        return res.status(404).json({ error: 'Incident report not found.' });
      }

      // Fields resolution
      const name = supervisor_name !== undefined ? supervisor_name : existing.supervisor_name;
      const role = supervisor_role !== undefined ? supervisor_role : existing.supervisor_role;
      const loc = location !== undefined ? location : (site_location !== undefined ? site_location : existing.location);
      const date = incident_date !== undefined ? incident_date : (incident_timestamp !== undefined ? incident_timestamp : existing.incident_date);
      const title = incident_title !== undefined ? incident_title : (incident_type !== undefined ? incident_type : existing.incident_title);
      const sev = severity !== undefined ? severity : (severity_level !== undefined ? severity_level : existing.severity);
      const desc = incident_description !== undefined ? incident_description : (raw_description !== undefined ? raw_description : existing.incident_description);
      const reportMarkdown = ai_generated_report !== undefined ? ai_generated_report : (generated_report_markdown !== undefined ? generated_report_markdown : existing.ai_generated_report);

      // Regenerate PDF if core report text was updated
      let pdfFilename = existing.pdf_filename;
      if (reportMarkdown !== existing.ai_generated_report) {
        // delete old PDF
        deletePDF(existing.pdf_filename);
        // generate new PDF
        try {
          pdfFilename = await generatePDF(id, reportMarkdown);
        } catch (pdfErr) {
          logger.error('Failed to regenerate PDF on update', pdfErr);
        }
      }

      const updated = await prisma.incidentReport.update({
        where: { id },
        data: {
          supervisor_name: name,
          supervisor_role: role,
          location: loc,
          incident_date: date,
          incident_title: title,
          severity: sev,
          incident_description: desc,
          weather_conditions: weather_conditions !== undefined ? weather_conditions : existing.weather_conditions,
          immediate_actions: immediate_actions !== undefined ? immediate_actions : existing.immediate_actions,
          witness_details: witness_details !== undefined ? witness_details : existing.witness_details,
          ai_generated_report: reportMarkdown,
          pdf_filename: pdfFilename
        }
      });

      res.json({
        success: true,
        report: updated
      });

    } catch (err) {
      logger.error(`Failed to update report ${id}`, err);
      res.status(500).json({ error: 'Failed to update report: ' + err.message });
    }
  },

  // Delete Report
  async deleteReport(req, res) {
    const { id } = req.params;
    try {
      const report = await prisma.incidentReport.findUnique({
        where: { id }
      });
      if (!report) {
        return res.status(404).json({ error: 'Incident report not found.' });
      }

      // Delete PDF file from server filesystem
      if (report.pdf_filename) {
        deletePDF(report.pdf_filename);
      }

      // Delete database record (feedbacks will cascade delete)
      await prisma.incidentReport.delete({
        where: { id }
      });

      res.json({ success: true, message: 'Incident report deleted successfully.' });
    } catch (err) {
      logger.error(`Failed to delete report ${id}`, err);
      res.status(500).json({ error: 'Failed to delete incident report: ' + err.message });
    }
  }
};

module.exports = reportController;
