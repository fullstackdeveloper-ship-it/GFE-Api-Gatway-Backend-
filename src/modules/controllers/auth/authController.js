const authService = require('../../services/auth/authService');

class AuthController {
  async login(password) {
    try {
      if (!password) {
        return {
          success: false,
          error: 'Password is required',
          status: 400
        };
      }

      const result = await authService.login(password);
      
      if (result.success) {
        console.log(`✅ [${new Date().toISOString()}] Login successful - Token generated`);
        return {
          ...result,
          status: 200
        };
      } else {
        console.log(`❌ [${new Date().toISOString()}] Login failed - ${result.message}`);
        return {
          ...result,
          status: 401
        };
      }
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Login error:`, error);
      return {
        success: false,
        error: 'Internal server error during login',
        status: 500
      };
    }
  }

  verifyToken(req, res) {
    console.log(`✅ [${new Date().toISOString()}] Token verification successful`);
    return {
      success: true,
      message: 'Token is valid',
      user: req.user,
      status: 200
    };
  }

  async changePassword(newPassword, req) {
    try {
      if (!newPassword) {
        console.log(`❌ [${new Date().toISOString()}] Password change failed - Missing new password`);
        return {
          success: false,
          error: 'New password is required',
          status: 400
        };
      }

      const result = await authService.changePassword(newPassword);
      
      if (result.success) {
        console.log(`✅ [${new Date().toISOString()}] Password changed successfully`);
        return {
          ...result,
          status: 200
        };
      } else {
        console.log(`❌ [${new Date().toISOString()}] Password change failed - ${result.message}`);
        return {
          ...result,
          status: 400
        };
      }
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Password change error:`, error);
      return {
        success: false,
        error: 'Internal server error during password change',
        status: 500
      };
    }
  }

  logout(req) {
    console.log(`🚀 [${new Date().toISOString()}] POST /api/auth/logout - Request received`);
    console.log(`✅ [${new Date().toISOString()}] Logout successful - Token invalidated on client`);
    
    return {
      success: true,
      message: 'Logout successful',
      status: 200
    };
  }
}

module.exports = AuthController;
