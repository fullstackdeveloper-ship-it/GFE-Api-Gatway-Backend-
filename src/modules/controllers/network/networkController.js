const services = require('../../services');

/**
 * Network Controller
 * Handles all network-related operations
 */
class NetworkController {
  constructor() {
    this.networkManager = services.network.NetworkManager;
  }

  /**
   * Handle GET /api/net/ifaces
   */
  async getInterfaces(req, res) {
    try {
      const onlyParam = req.query.only;
      if (onlyParam) {
        const requestedInterfaces = onlyParam.split(',').map(iface => iface.trim());
        const interfaces = [];
        
        for (const iface of requestedInterfaces) {
          if (this.networkManager.managedInterfaces && 
              Array.isArray(this.networkManager.managedInterfaces) && 
              this.networkManager.managedInterfaces.includes(iface)) {
            const interfaceInfo = await this.networkManager.getInterfaceInfo(iface);
            interfaces.push(interfaceInfo);
          }
        }

        res.json({ 
          interfaces,
          total_count: interfaces.length
        });
      } else {
        // Get all managed interfaces
        const managedInterfaces = this.networkManager.managedInterfaces || [];
        const interfaces = [];
        
        for (const iface of managedInterfaces) {
          try {
            const interfaceInfo = await this.networkManager.getInterfaceInfo(iface);
            interfaces.push(interfaceInfo);
          } catch (error) {
            console.error(`Error getting info for ${iface}:`, error);
          }
        }
        
        res.json({
          interfaces,
          total_count: interfaces.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error getting interfaces:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle GET /api/net/ifaces/:interfaceName
   */
  async getInterfaceInfo(req, res) {
    const { interfaceName } = req.params;
    try {
      const interfaceInfo = await this.networkManager.getInterfaceInfo(interfaceName);
      res.json(interfaceInfo);
    } catch (error) {
      res.status(500).json({ message: `Failed to get info for ${interfaceName}`, error: error.message });
    }
  }

  /**
   * Handle GET /api/net/connectivity
   */
  async getConnectivity(req, res) {
    try {
      const onlyParam = req.query.only;
      if (onlyParam) {
        const requestedInterfaces = onlyParam.split(',').map(iface => iface.trim());
        const results = {};
        
        for (const iface of requestedInterfaces) {
          if (this.networkManager.managedInterfaces && 
              Array.isArray(this.networkManager.managedInterfaces) && 
              this.networkManager.managedInterfaces.includes(iface)) {
            try {
              const connectivity = await this.networkManager.getConnectivityStatus(iface);
              results[iface] = connectivity;
            } catch (error) {
              console.error(`Error getting connectivity for ${iface}:`, error);
              results[iface] = {
                local: { connected: false, details: `Error: ${error.message}` },
                internet: { reachable: false, details: `Error: ${error.message}` }
              };
            }
          }
        }

        res.json({ 
          connectivity: results,
          timestamp: new Date().toISOString()
        });
      } else {
        // Return connectivity for all managed interfaces
        const results = {};
        const managedInterfaces = this.networkManager.managedInterfaces || [];
        
        for (const iface of managedInterfaces) {
          try {
            const connectivity = await this.networkManager.getConnectivityStatus(iface);
            results[iface] = connectivity;
          } catch (error) {
            console.error(`Error getting connectivity for ${iface}:`, error);
            results[iface] = {
              local: { connected: false, details: `Error: ${error.message}` },
              internet: { reachable: false, details: `Error: ${error.message}` }
            };
          }
        }

        res.json({ 
          connectivity: results,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error getting connectivity status:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new NetworkController();
