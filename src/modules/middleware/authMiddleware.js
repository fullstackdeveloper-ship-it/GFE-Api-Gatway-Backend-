const authService = require('../services/auth/authService');

/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log(`❌ [${new Date().toISOString()}] Authentication failed - No token provided`);
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const result = authService.verifyToken(token);
  
  if (!result.valid) {
    console.log(`❌ [${new Date().toISOString()}] Authentication failed - Invalid token: ${result.error}`);
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }

  console.log(`✅ [${new Date().toISOString()}] Authentication successful`);
  req.user = result.payload;
  next();
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const result = authService.verifyToken(token);
    if (result.valid) {
      req.user = result.payload;
      req.isAuthenticated = true;
    } else {
      req.isAuthenticated = false;
    }
  } else {
    req.isAuthenticated = false;
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth
};
