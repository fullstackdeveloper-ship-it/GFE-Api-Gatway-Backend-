const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/settings');

class AuthService {
  constructor() {
    this.currentPassword = config.DEFAULT_PASSWORD;
    this.loadPasswordFromConfig();
  }

  /**
   * Load password from config file
   */
  async loadPasswordFromConfig() {
    try {
      const configPath = path.join(__dirname, '../config/settings.js');
      const configContent = await fs.readFile(configPath, 'utf8');
      
      // Extract password from config file
      const passwordMatch = configContent.match(/DEFAULT_PASSWORD:\s*process\.env\.DEFAULT_PASSWORD\s*\|\|\s*['"`]([^'"`]+)['"`]/);
      if (passwordMatch) {
        this.currentPassword = passwordMatch[1];
      }
    } catch (error) {
      console.error('Error loading password from config:', error);
      // Fallback to default password
      this.currentPassword = config.DEFAULT_PASSWORD;
    }
  }

  /**
   * Update password in config file
   */
  async updatePassword(newPassword) {
    try {
      const configPath = path.join(__dirname, '../config/settings.js');
      let configContent = await fs.readFile(configPath, 'utf8');
      
      // Update the password in the config file
      configContent = configContent.replace(
        /DEFAULT_PASSWORD:\s*process\.env\.DEFAULT_PASSWORD\s*\|\|\s*['"`][^'"`]*['"`]/,
        `DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || '${newPassword}'`
      );
      
      await fs.writeFile(configPath, configContent, 'utf8');
      this.currentPassword = newPassword;
      
      console.log('✅ Password updated successfully in config file');
      return true;
    } catch (error) {
      console.error('❌ Error updating password in config:', error);
      return false;
    }
  }

  /**
   * Validate password
   */
  validatePassword(password) {
    return password === this.currentPassword;
  }

  /**
   * Generate JWT token
   */
  generateToken() {
    const payload = {
      authenticated: true,
      timestamp: new Date().toISOString()
    };
    
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Login with password
   */
  async login(password) {
    console.log(`🔐 [${new Date().toISOString()}] Login attempt`);
    
    if (this.validatePassword(password)) {
      const token = this.generateToken();
      console.log(`✅ [${new Date().toISOString()}] Login successful`);
      return {
        success: true,
        token,
        message: 'Login successful'
      };
    } else {
      console.log(`❌ [${new Date().toISOString()}] Login failed - Invalid password`);
      return {
        success: false,
        message: 'Invalid password'
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(newPassword) {
    console.log(`🔐 [${new Date().toISOString()}] Password change attempt`);
    
    if (newPassword.length < 6) {
      console.log(`❌ [${new Date().toISOString()}] Password change failed - Password too short`);
      return {
        success: false,
        message: 'New password must be at least 6 characters long'
      };
    }

    const updateSuccess = await this.updatePassword(newPassword);
    
    if (updateSuccess) {
      console.log(`✅ [${new Date().toISOString()}] Password changed successfully`);
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } else {
      console.log(`❌ [${new Date().toISOString()}] Password change failed - Config update error`);
      return {
        success: false,
        message: 'Failed to update password in configuration'
      };
    }
  }
}

module.exports = new AuthService();
