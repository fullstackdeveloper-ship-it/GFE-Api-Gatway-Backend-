const { exec } = require('child_process');
const util = require('util');
const services = require('../../services');

const execAsync = util.promisify(exec);

/**
 * System Controller
 * Handles system monitoring and utility operations
 */
class SystemController {
  constructor() {
    this.databaseService = services.database.DatabaseService.getInstance();
  }

  /**
   * Handle GET /api/ping
   */
  async ping(req, res) {
    try {
      // Use curl to check HTTP connectivity instead of ICMP ping
      const { stdout, stderr } = await execAsync('curl -sS -o /dev/null -w "%{http_code}\n" https://connectivitycheck.gstatic.com/generate_204');
      
      // Check if HTTP response code is 204 (success)
      const httpCode = parseInt(stdout.trim());
      const isOnline = httpCode === 204;
      
      res.json({
        status: isOnline ? 'online' : 'offline',
        connectivity: isOnline,
        target: 'https://connectivitycheck.gstatic.com/generate_204',
        httpCode: httpCode,
        timestamp: new Date().toISOString(),
        ...(isOnline && { latency: null }) // HTTP doesn't provide latency like ping
      });
    } catch (error) {
      res.json({
        status: 'offline',
        connectivity: false,
        target: 'https://connectivitycheck.gstatic.com/generate_204',
        error: 'Network unreachable',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle GET /api/memory
   */
  async getMemoryUsage(req, res) {
    try {
      const usage = process.memoryUsage();
      const uptime = process.uptime();
      
      res.json({
        memory: {
          rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(usage.external / 1024 / 1024) + ' MB',
          arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) + ' MB'
        },
        uptime: {
          seconds: Math.round(uptime),
          human: Math.round(uptime / 60) + ' minutes'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get memory info',
        details: error.message 
      });
    }
  }

  /**
   * Handle GET /api/disk
   */
  async getDiskUsage(req, res) {
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const data = lines[1].split(/\s+/);
      
      const totalSpace = data[1];
      const usedSpace = data[2];
      const availableSpace = data[3];
      const usedPercent = parseInt(data[4]);
      
      res.json({
        disk: {
          total: totalSpace,
          used: usedSpace,
          available: availableSpace,
          usedPercent: usedPercent + '%'
        },
        status: usedPercent > 80 ? 'WARNING' : 'OK',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get disk info',
        details: error.message 
      });
    }
  }

  /**
   * Handle GET /api/db/size
   */
  async getDatabaseSize(req, res) {
    try {
      const result = await this.databaseService.getDatabaseSize();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get database size',
        details: error.message 
      });
    }
  }

  /**
   * Handle POST /api/db/cleanup
   */
  async cleanupDatabase(req, res) {
    try {
      const retentionDays = req.body.retentionDays || 30;
      const result = await this.databaseService.cleanupOldData(retentionDays);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to cleanup database',
        details: error.message 
      });
    }
  }

  /**
   * Handle GET /health
   */
  async getHealth(req, res) {
    try {
      const socketManager = require('../../services/socket/socketManager');
      const natsClient = require('../../services/nats/natsClient');
      
      res.json({
        status: 'healthy',
        nats_connected: natsClient.getConnectionStatus(),
        clients_connected: socketManager.getConnectedClientsCount(),
        clients_info: socketManager.getConnectedClientsInfo(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new SystemController();
