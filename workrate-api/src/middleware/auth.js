import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

/**
 * requireAuth — Express middleware.
 * Validates the Bearer token in the Authorization header.
 * On success, attaches req.user = { id, email, plan } and calls next().
 * On failure, returns 401.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id:    payload.sub,
      email: payload.email,
      plan:  payload.plan,
    };
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

/**
 * requireAdmin — run after requireAuth. Ensures user has is_admin = true.
 * Attaches full user row to req.adminUser.
 */
export async function requireAdmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { rows } = await query(
      'SELECT id, email, name, plan, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = rows[0];
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to verify admin' });
  }
}

/**
 * optionalAuth — same as requireAuth but doesn't block on missing token.
 * Used for public endpoints that show more data when authenticated.
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
      req.user = { id: payload.sub, email: payload.email, plan: payload.plan };
    } catch (_) {
      // Token invalid — proceed as unauthenticated
    }
  }
  next();
}
