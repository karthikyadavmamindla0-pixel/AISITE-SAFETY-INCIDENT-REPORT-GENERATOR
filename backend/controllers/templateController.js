const prisma = require('../database/prisma');
const logger = require('../utils/logger');

const templateController = {
  async getTemplates(req, res) {
    try {
      const templates = await prisma.templatePreset.findMany();
      res.json(templates);
    } catch (err) {
      logger.error('Failed to retrieve templates', err);
      res.status(500).json({ error: 'Failed to retrieve templates: ' + err.message });
    }
  }
};

module.exports = templateController;
