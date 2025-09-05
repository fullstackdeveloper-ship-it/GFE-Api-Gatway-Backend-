const express = require('express');
const router = express.Router();
const AuthController = require('../../modules/controllers/auth/authController');
const { authenticateToken } = require('../../modules/middleware/authMiddleware');

// Initialize auth controller
const authController = new AuthController();

/**
 * Login endpoint
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/login - Request received`);
  
  try {
    const { password } = req.body;
    const result = await authController.login(password);
    res.status(result.status).json(result);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Login error:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login'
    });
  }
});

/**
 * Verify token endpoint
 * GET /api/auth/verify
 */
router.get('/verify', authenticateToken, (req, res) => {
  const result = authController.verifyToken(req, res);
  res.status(result.status).json(result);
});

/**
 * Change password endpoint (requires authentication)
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/change-password - Request received`);
  
  try {
    const { newPassword } = req.body;
    const result = await authController.changePassword(newPassword, req);
    res.status(result.status).json(result);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Password change error:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during password change'
    });
  }
});

/**
 * Logout endpoint (client-side token removal)
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, (req, res) => {
  const result = authController.logout(req);
  res.status(result.status).json(result);
});

module.exports = router;
