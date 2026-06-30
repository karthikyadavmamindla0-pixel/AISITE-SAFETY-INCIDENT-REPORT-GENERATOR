const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const errorLogPath = path.join(logDir, 'error.log');
const accessLogPath = path.join(logDir, 'access.log');

function formatMessage(message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}\n`;
}

const logger = {
  info(message) {
    const formatted = formatMessage(`INFO: ${message}`);
    console.log(formatted.trim());
    try {
      fs.appendFileSync(accessLogPath, formatted);
    } catch (err) {
      console.error('Failed to write to access log:', err.message);
    }
  },
  
  error(message, error) {
    const errDetails = error ? (error.stack || error.message || error) : '';
    const formatted = formatMessage(`ERROR: ${message} - ${errDetails}`);
    console.error(formatted.trim());
    try {
      fs.appendFileSync(errorLogPath, formatted);
    } catch (err) {
      console.error('Failed to write to error log:', err.message);
    }
  }
};

module.exports = logger;
