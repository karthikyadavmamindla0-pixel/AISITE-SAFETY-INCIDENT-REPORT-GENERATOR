// Run database environment configuration and schema checks
require('./database/dbSetup')();

const app = require('./app');
const prisma = require('./database/prisma');
const seed = require('./database/seed');
const os = require('os');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Helper to get local IPv4 addresses of the host machine
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Prisma Database connected successfully.');

    // Auto-run seeds to populate templates/users
    await seed();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`  CROWNRIDGE LLP - AI SAFETY REPORT DESK SERVER`);
      console.log(`====================================================`);
      console.log(`Server is running on port ${PORT}`);
      console.log(`Access routes locally at:`);
      console.log(`  - Local:           http://localhost:${PORT}`);
      const networkIps = getLocalIpAddresses();
      if (networkIps.length > 0) {
        console.log(`Access routes on your mobile device (same Wi-Fi):`);
        networkIps.forEach(ip => {
          console.log(`  - Mobile Network:  http://${ip}:${PORT}`);
        });
      } else {
        console.log(`No active local network interfaces detected.`);
      }
      console.log(`====================================================`);
    });
  } catch (err) {
    logger.error('Failed to initialize server', err);
    process.exit(1);
  }
}

startServer();
