const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "tirehub-dev-secret-change-in-production";

/**
 * Express middleware that verifies a Bearer token on every /api request.
 * Public routes (login) are exempted via the SKIP_AUTH list.
 *
 * The decoded token payload is attached to req.user so route handlers
 * can read req.user.username if needed.
 */
const SKIP_AUTH = ["/api/auth/login"];

function authMiddleware(req, res, next) {
  if (SKIP_AUTH.includes(req.path)) return next();

  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized — token required" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized — invalid or expired token" });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
