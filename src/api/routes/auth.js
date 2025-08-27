const express = require('express');
const router = express.Router();
const authService = require('../../services/authService');
const { authenticateToken } = require('../../middleware/authMiddleware');

/**
 * Login endpoint
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/login - Request received`);
  
  try {
    const { password } = req.body;

    if (!password) {
      console.log(`❌ [${new Date().toISOString()}] Login failed - No password provided`);
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const result = await authService.login(password);
    
    if (result.success) {
      console.log(`✅ [${new Date().toISOString()}] Login successful - Token generated`);
      return res.status(200).json(result);
    } else {
      console.log(`❌ [${new Date().toISOString()}] Login failed - ${result.message}`);
      return res.status(401).json(result);
    }

  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Login error:`, error);
    return res.status(500).json({
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
  console.log(`✅ [${new Date().toISOString()}] Token verification successful`);
  return res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

/**
 * Change password endpoint (requires authentication)
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/change-password - Request received`);
  
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      console.log(`❌ [${new Date().toISOString()}] Password change failed - Missing passwords`);
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    const result = await authService.changePassword(currentPassword, newPassword);
    
    if (result.success) {
      console.log(`✅ [${new Date().toISOString()}] Password changed successfully`);
      return res.status(200).json(result);
    } else {
      console.log(`❌ [${new Date().toISOString()}] Password change failed - ${result.message}`);
      return res.status(400).json(result);
    }

  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Password change error:`, error);
    return res.status(500).json({
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
  console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/logout - Request received`);
  console.log(`✅ [${new Date().toISOString()}] Logout successful - Token invalidated on client`);
  
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;
