const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function generateShortId() {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

module.exports = {
  hashPassword,
  generateSalt,
  generateShortId
};
