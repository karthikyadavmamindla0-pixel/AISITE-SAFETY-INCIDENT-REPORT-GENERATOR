const prisma = require('../database/prisma');
const logger = require('./logger');

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Session not found.' });
    }

    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      try {
        await prisma.session.delete({ where: { token } });
      } catch (delErr) {
        logger.error('Failed to delete expired token', delErr);
      }
      return res.status(401).json({ error: 'Unauthorized: Session expired.' });
    }

    req.user = {
      id: session.user.id,
      username: session.user.username,
      full_name: session.user.full_name,
      role: session.user.role
    };
    req.token = token;
    next();
  } catch (err) {
    logger.error('Auth middleware error', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

module.exports = requireAuth;
