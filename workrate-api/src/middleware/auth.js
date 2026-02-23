import jwt from 'jsonwebtoken';

/**
 * requireAuth — Express middleware.
 * Validates the Bearer token in the Authorization header.
 * On success, attaches req.user = { id, email, plan } and calls next().
 * On failure, returns 401.
 *
 * Used on every route that needs a logged-in user.
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
