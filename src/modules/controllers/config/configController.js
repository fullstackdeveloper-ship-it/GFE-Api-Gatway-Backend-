const path = require('path');
const fs = require('fs').promises;

/**
 * Configuration Controller
 * Handles all configuration-related operations
 */
class ConfigController {
  constructor() {
    this.CONFIG_FILE_PATH = path.join(__dirname, '../../../../data/app-config.json');
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDirectory() {
    const configDir = path.dirname(this.CONFIG_FILE_PATH);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  /**
   * Read configuration from file
   */
  async readConfig() {
    try {
      await this.ensureConfigDirectory();
      const data = await fs.readFile(this.CONFIG_FILE_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create with default config
      if (error.code === 'ENOENT') {
        const defaultConfig = this.getDefaultConfig();
        await this.writeConfig(defaultConfig);
        return defaultConfig;
      }
      throw error;
    }
  }

  /**
   * Write configuration to file
   */
  async writeConfig(configData) {
    await this.ensureConfigDirectory();
    await fs.writeFile(this.CONFIG_FILE_PATH, JSON.stringify(configData, null, 2));
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      siteName: 'Green Project',
      language: 'en',
      timezone: 'UTC',
      deviceTime: null,
      theme: 'light'
    };
  }

  /**
   * Get network configuration
   */
  async getNetworkConfig(interfaceName = null) {
    try {
      const config = await this.readConfig();
      if (interfaceName) {
        return config.network?.[interfaceName] || {};
      }
      return config.network || {};
    } catch (error) {
      throw new Error(`Failed to get network config: ${error.message}`);
    }
  }

  /**
   * Set network configuration
   */
  async setNetworkConfig(newConfig, interfaceName = null) {
    try {
      const currentConfig = await this.readConfig();
      
      if (interfaceName) {
        if (!currentConfig.network) {
          currentConfig.network = {};
        }
        currentConfig.network[interfaceName] = newConfig;
      } else {
        currentConfig.network = newConfig;
      }
      
      await this.writeConfig(currentConfig);
    } catch (error) {
      throw new Error(`Failed to set network config: ${error.message}`);
    }
  }

  /**
   * Handle GET /api/config
   */
  async getConfig(req, res) {
    try {
      const configData = await this.readConfig();
      res.json(configData);
    } catch (error) {
      console.error('Error reading config:', error);
      res.status(500).json({ error: 'Failed to read configuration' });
    }
  }

  /**
   * Handle PUT /api/config
   */
  async updateConfig(req, res) {
    try {
      const currentConfig = await this.readConfig();
      const updatedConfig = { ...currentConfig, ...req.body };
      await this.writeConfig(updatedConfig);
      res.json(updatedConfig);
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * Handle GET /api/config/network
   */
  async getNetworkConfig(req, res) {
    try {
      const networkConfig = await this.getNetworkConfig();
      res.json(networkConfig);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get network config', error: error.message });
    }
  }

  /**
   * Handle POST /api/config/network
   */
  async setNetworkConfig(req, res) {
    try {
      await this.setNetworkConfig(req.body);
      res.json({ message: 'Network config updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to set network config', error: error.message });
    }
  }

  /**
   * Handle GET /api/config/network/:interfaceName
   */
  async getInterfaceConfig(req, res) {
    const { interfaceName } = req.params;
    try {
      const interfaceConfig = await this.getNetworkConfig(interfaceName);
      res.json(interfaceConfig);
    } catch (error) {
      res.status(500).json({ message: `Failed to get config for ${interfaceName}`, error: error.message });
    }
  }

  /**
   * Handle POST /api/config/network/:interfaceName
   */
  async setInterfaceConfig(req, res) {
    const { interfaceName } = req.params;
    try {
      await this.setNetworkConfig(req.body, interfaceName);
      res.json({ message: `Config for ${interfaceName} updated successfully` });
    } catch (error) {
      res.status(500).json({ message: `Failed to set config for ${interfaceName}`, error: error.message });
    }
  }
}

module.exports = new ConfigController();
