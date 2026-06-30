const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

function setupDatabase() {
  logger.info('Initializing database configuration check...');

  // 1. Resolve DATABASE_URL fallback
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    dbUrl = 'file:../reports.db';
    process.env.DATABASE_URL = dbUrl;
    logger.info('DATABASE_URL is not set. Defaulting to local SQLite file: ' + dbUrl);
  }

  // 2. Detect target provider
  let targetProvider = 'sqlite';
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    targetProvider = 'postgresql';
    logger.info('Detected PostgreSQL database URL.');
  } else {
    logger.info('Using SQLite database.');
  }

  // 3. Read schema.prisma and verify provider
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    logger.error('Prisma schema file not found at: ' + schemaPath);
    return;
  }

  let schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // Regex to match: provider = "sqlite" or provider = "postgresql"
  const providerRegex = /provider\s*=\s*"([^"]+)"/;
  const match = schemaContent.match(providerRegex);
  
  if (match) {
    const currentProvider = match[1];
    if (currentProvider !== targetProvider) {
      logger.info(`Database provider mismatch. Changing provider from "${currentProvider}" to "${targetProvider}"...`);
      
      schemaContent = schemaContent.replace(
        /provider\s*=\s*"([^"]+)"/,
        `provider = "${targetProvider}"`
      );
      
      fs.writeFileSync(schemaPath, schemaContent, 'utf8');
      logger.info('Updated prisma/schema.prisma database provider.');

      // Re-run Prisma generate to compile client with the new database engine
      try {
        logger.info('Re-generating Prisma Client for ' + targetProvider + '...');
        execSync('npx prisma generate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        logger.info('Prisma Client generated successfully.');
      } catch (err) {
        logger.error('Failed to run npx prisma generate', err);
      }
    }
  }

  // 4. Auto-run db push in production / Render to ensure tables exist
  const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
  if (isRender) {
    try {
      logger.info('Auto-pushing database schema to ' + targetProvider + '...');
      execSync('npx prisma db push --accept-data-loss', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      logger.info('Database schema pushed successfully.');
    } catch (err) {
      logger.error('Failed to run npx prisma db push', err);
    }
  }
}

module.exports = setupDatabase;
