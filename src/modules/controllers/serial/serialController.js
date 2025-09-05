const services = require('../../services');

/**
 * Serial Controller
 * Handles all serial port-related operations
 */
class SerialController {
  constructor() {
    this.serialManager = services.serial.SerialManager;
  }

  /**
   * Handle GET /api/serial/ports
   */
  async getSerialPorts(req, res) {
    try {
      const result = await this.serialManager.getSerialPorts();
      res.json(result);
    } catch (error) {
      console.error('Error getting serial ports:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle GET /api/serial/supported
   */
  async getSupportedValues(req, res) {
    try {
      const result = this.serialManager.getSupportedValues();
      res.json(result);
    } catch (error) {
      console.error('Error getting supported serial values:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle PUT /api/serial/ports/:deviceId
   */
  async updateSerialPort(req, res) {
    try {
      const { deviceId } = req.params;
      const data = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      const result = await this.serialManager.updateSerialPort(deviceId, data);

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error(`Error updating serial port ${req.params.deviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle PUT /api/serial-ports/:portName
   */
  async updateSerialPortConfig(req, res) {
    try {
      const { portName } = req.params; // COM1 or COM2
      const payload = req.body; // { baud, dataBits, stopBits, parity, mode }
      console.log('🔧 Controller: update serial-ports', { portName, payload });

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid or missing payload' });
      }

      const result = await this.serialManager.updateSerialPortConfig(portName, payload);
      if (result.success) {
        return res.json(result);
      }
      return res.status(400).json(result);
    } catch (error) {
      console.error('❌ Controller error updating serial-ports:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new SerialController();
