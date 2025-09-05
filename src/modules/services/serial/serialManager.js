const { SerialPort } = require('serialport');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SerialManager {
  constructor() {
    this.ports = new Map();
    this.connections = new Map();
    this.supportedValues = {
      baudRates: [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600],
      dataBits: [5, 6, 7, 8],
      stopBits: [1, 1.5, 2],
      parities: ['none', 'even', 'odd', 'mark', 'space'],
      flowControl: ['none', 'xon', 'xoff', 'rtscts', 'dtrdsr']
    };
  }

  async getSerialPorts() {
    try {
      console.log('🔌 Getting serial ports (restricted to COM1:/dev/ttyS4 and COM2:/dev/ttyS5)...');

      // Helper to parse stty output safely (unchanged parsing logic)
      const parseSttyOutput = (text) => {
        const result = { baud: 'Unknown', dataBits: 'Unknown', stopBits: 'Unknown', parity: 'Unknown', mode: 'Unknown' };
        if (!text || typeof text !== 'string') return result;
      
        try {
          // baud
          const speedMatch = text.match(/speed\s+(\d+)\s+baud/i);
          if (speedMatch) result.baud = Number(speedMatch[1]);
      
          // data bits
          const csMatch = text.match(/\bcs([5678])\b/i);
          if (csMatch) result.dataBits = Number(csMatch[1]);
      
          // ---- robust flag detection (tokens) ----
          const tokens = new Set(
            text
              .replace(/[;:,]/g, ' ')           // strip punctuation that can stick to tokens
              .split(/\s+/)
              .filter(Boolean)
              .map(t => t.toLowerCase())
          );
          const has = (name) => tokens.has(name);
          const hasNeg = (name) => tokens.has(`-${name}`);
          const flagOn = (name) => has(name) && !hasNeg(name);
      
          // stop bits
          result.stopBits = flagOn('cstopb') ? 2 : 1;
      
          // parity
          const parenbOn = flagOn('parenb');
          const odd = flagOn('parodd');
          const cmspar = flagOn('cmspar');
      
          if (!parenbOn) {
            result.parity = 'none';
          } else if (cmspar && odd) {
            result.parity = 'mark';
          } else if (cmspar && !odd) {
            result.parity = 'space';
          } else {
            result.parity = odd ? 'odd' : 'even';
          }
      
          // mode
          if (flagOn('icanon')) {
            result.mode = 'canonical';
          } else if (hasNeg('icanon')) {
            result.mode = 'raw';
          } else {
            result.mode = 'Unknown';
          }
        } catch (_) {}
      
        return result;
      };
      
      

      // Query stty for a given path (unchanged error handling)
      const getSttyInfo = async (portPath) => {
        try {
          const { stdout } = await execAsync(`stty -F ${portPath} -a`, { timeout: 2000, maxBuffer: 1024 * 64 });
          const parsed = parseSttyOutput(stdout);
          console.log(`🔎 stty for ${portPath}:`, parsed);
          return parsed;
        } catch (error) {
          console.warn(`⚠️  stty failed for ${portPath}: ${error.message}`);
          return { baud: 'Unknown', dataBits: 'Unknown', stopBits: 'Unknown', parity: 'Unknown' };
        }
      };

      const targets = [
        { name: 'COM1', path: '/dev/ttyS4' },
        { name: 'COM2', path: '/dev/ttyS5' }
      ];

      const result = {};
      for (const t of targets) {
        const info = await getSttyInfo(t.path);
        result[t.name] = {
          baud: info.baud,
          dataBits: info.dataBits,
          stopBits: info.stopBits,
          parity: info.parity,
          mode: typeof info.mode !== 'undefined' ? info.mode : 'Unknown'
        };
      }

      // Include dropdown options as per GNU stty allowed values
      result.dropdownOptions = {
        baud: [110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
        dataBits: [5, 6, 7, 8],
        stopBits: [1, 2],
        parity: ['none', 'even', 'odd', 'mark', 'space'],
        mode: ['raw', 'canonical']
      };

      return result;
      
    } catch (error) {
      console.error('❌ Error getting serial ports:', error.message);
      return {
        COM1: { baud: 'Unknown', dataBits: 'Unknown', stopBits: 'Unknown', parity: 'Unknown', mode: 'Unknown' },
        COM2: { baud: 'Unknown', dataBits: 'Unknown', stopBits: 'Unknown', parity: 'Unknown', mode: 'Unknown' }
      };
    }
  }

  /**
   * Update runtime serial configuration for COM1/COM2 using stty
   * @param {string} portName - 'COM1' or 'COM2'
   * @param {{baud:number,dataBits:number,stopBits:number,parity:string,mode:string}} config
   */
  async updateSerialPortConfig(portName, config) {
    try {
      console.log(`🔧 Updating serial config for ${portName}...`);
      if (!['COM1', 'COM2'].includes(portName)) {
        return { success: false, error: `Unsupported portName: ${portName}. Use COM1 or COM2.` };
      }

      const device = portName === 'COM1' ? '/dev/ttyS4' : '/dev/ttyS5';
      const allowed = {
        baud: [110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
        dataBits: [5, 6, 7, 8],
        stopBits: [1, 2],
        parity: ['none', 'even', 'odd', 'mark', 'space'],
        mode: ['raw', 'canonical']
      };

      const { baud, dataBits, stopBits, parity, mode } = config || {};
      console.log(`   Incoming payload:`, { baud, dataBits, stopBits, parity, mode });

      // Basic validation
      if (!allowed.baud.includes(baud)) {
        return { success: false, error: `Invalid baud: ${baud}` };
      }
      if (!allowed.dataBits.includes(dataBits)) {
        return { success: false, error: `Invalid dataBits: ${dataBits}` };
      }
      if (!allowed.stopBits.includes(stopBits)) {
        return { success: false, error: `Invalid stopBits: ${stopBits}` };
      }
      if (!allowed.parity.includes(parity)) {
        return { success: false, error: `Invalid parity: ${parity}` };
      }
      if (!allowed.mode.includes(mode)) {
        return { success: false, error: `Invalid mode: ${mode}` };
      }

      // Build stty tokens
      const tokens = [];
      // baud
      tokens.push(String(baud));
      // data bits
      tokens.push(`cs${dataBits}`);
      // stop bits
      tokens.push(stopBits === 2 ? 'cstopb' : '-cstopb');
      // parity
      if (parity === 'none') {
        tokens.push('-parenb');
        tokens.push('-cmspar');
      } else if (parity === 'even') {
        tokens.push('parenb', '-parodd', '-cmspar');
      } else if (parity === 'odd') {
        tokens.push('parenb', 'parodd', '-cmspar');
      } else if (parity === 'mark') {
        tokens.push('parenb', 'parodd', 'cmspar');
      } else if (parity === 'space') {
        tokens.push('parenb', '-parodd', 'cmspar');
      }
      // mode
      tokens.push(mode === 'raw' ? '-icanon' : 'icanon');

      const cmd = `stty -F ${device} ${tokens.join(' ')}`;
      console.log(`   Executing: ${cmd}`);
      try {
        await execAsync(cmd, { timeout: 3000, maxBuffer: 1024 * 64 });
        console.log(`   ✅ stty applied successfully on ${device}`);
      } catch (e) {
        console.error(`   ❌ stty apply failed on ${device}: ${e.message}`);
        return { success: false, error: e.message, command: cmd };
      }
      

      // Read back using existing getSerialPorts (reuses parseSttyOutput)
      const after = await this.getSerialPorts();
      const applied = after && after[portName] ? after[portName] : undefined;
      console.log(`   🔎 Read-back (${portName}):`, applied);

      return {
        success: true,
        port: portName,
        device,
        applied,
        command: cmd
      };
    } catch (error) {
      console.error(`❌ Error updating serial config for ${portName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async connectToPort(portPath, config = {}) {
    try {
      console.log(`🔌 Connecting to serial port: ${portPath}`);
      
      if (this.connections.has(portPath)) {
        console.log(`⚠️  Port ${portPath} is already connected`);
        return { success: false, error: 'Port is already connected' };
      }
      
      // Default configuration
      const defaultConfig = {
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        rtscts: false,
        xon: false,
        xoff: false,
        xany: false
      };
      
      const finalConfig = { ...defaultConfig, ...config };
      console.log(`   Configuration: ${JSON.stringify(finalConfig)}`);
      
      // Create serial port connection
      const port = new SerialPort({
        path: portPath,
        ...finalConfig
      });
      
      // Set up event handlers
      port.on('open', () => {
        console.log(`✅ Serial port ${portPath} opened successfully`);
        this.connections.set(portPath, {
          port,
          config: finalConfig,
          connectedAt: new Date(),
          stats: {
            bytesReceived: 0,
            bytesSent: 0,
            messagesReceived: 0,
            messagesSent: 0
          }
        });
      });
      
      port.on('data', (data) => {
        console.log(`📨 Received data from ${portPath}: ${data.length} bytes`);
        const connection = this.connections.get(portPath);
        if (connection) {
          connection.stats.bytesReceived += data.length;
          connection.stats.messagesReceived++;
        }
        
        // Emit data event for other parts of the system
        this.emit('data', { portPath, data, timestamp: new Date() });
      });
      
      port.on('error', (error) => {
        console.error(`❌ Serial port ${portPath} error:`, error.message);
        this.emit('error', { portPath, error: error.message, timestamp: new Date() });
      });
      
      port.on('close', () => {
        console.log(`🔌 Serial port ${portPath} closed`);
        this.connections.delete(portPath);
        this.emit('close', { portPath, timestamp: new Date() });
      });
      
      return { success: true, message: `Connected to ${portPath}` };
      
    } catch (error) {
      console.error(`❌ Failed to connect to ${portPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async disconnectFromPort(portPath) {
    try {
      console.log(`🔌 Disconnecting from serial port: ${portPath}`);
      
      const connection = this.connections.get(portPath);
      if (!connection) {
        console.log(`⚠️  Port ${portPath} is not connected`);
        return { success: false, error: 'Port is not connected' };
      }
      
      // Close the port
      connection.port.close();
      this.connections.delete(portPath);
      
      console.log(`✅ Disconnected from ${portPath}`);
      return { success: true, message: `Disconnected from ${portPath}` };
      
    } catch (error) {
      console.error(`❌ Error disconnecting from ${portPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendData(portPath, data) {
    try {
      const connection = this.connections.get(portPath);
      if (!connection) {
        return { success: false, error: 'Port is not connected' };
      }
      
      console.log(`📤 Sending data to ${portPath}: ${data.length || data.toString().length} bytes`);
      
      // Send the data
      connection.port.write(data, (error) => {
        if (error) {
          console.error(`❌ Error sending data to ${portPath}:`, error.message);
        } else {
          console.log(`✅ Data sent to ${portPath} successfully`);
          connection.stats.bytesSent += data.length || data.toString().length;
          connection.stats.messagesSent++;
        }
      });
      
      return { success: true, message: 'Data sent' };
      
    } catch (error) {
      console.error(`❌ Error sending data to ${portPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async updateSerialPort(deviceId, config) {
    try {
      console.log(`🔄 Updating serial port configuration for ${deviceId}`);
      
      // Check if port is connected
      if (this.connections.has(deviceId)) {
        console.log(`⚠️  Port ${deviceId} is connected, disconnecting first...`);
        await this.disconnectFromPort(deviceId);
      }
      
      // Connect with new configuration
      const result = await this.connectToPort(deviceId, config);
      
      if (result.success) {
        console.log(`✅ Serial port ${deviceId} updated successfully`);
        return { success: true, message: `Serial port ${deviceId} updated successfully` };
      } else {
        console.error(`❌ Failed to update serial port ${deviceId}:`, result.error);
        return result;
      }
      
    } catch (error) {
      console.error(`❌ Error updating serial port ${deviceId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  getSupportedValues() {
    return {
      ...this.supportedValues,
      timestamp: new Date().toISOString()
    };
  }

  getPortStatus(portPath) {
    const connection = this.connections.get(portPath);
    if (!connection) {
      return {
        connected: false,
        portPath,
        message: 'Port is not connected'
      };
    }
    
    return {
      connected: true,
      portPath,
      config: connection.config,
      connectedAt: connection.connectedAt,
      stats: connection.stats,
      isOpen: connection.port.isOpen
    };
  }

  getAllPortStatuses() {
    const statuses = [];
    
    for (const [portPath, connection] of this.connections) {
      statuses.push(this.getPortStatus(portPath));
    }
    
    return {
      ports: statuses,
      total: this.connections.size,
      timestamp: new Date().toISOString()
    };
  }

  // Event emitter methods (placeholder for now)
  emit(event, data) {
    console.log(`📡 Serial event: ${event}`, data);
    // In a real implementation, you would emit events to the main application
  }

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      totalConnections: this.connections.size,
      totalBytesReceived: 0,
      totalBytesSent: 0,
      totalMessagesReceived: 0,
      totalMessagesSent: 0
    };
    
    for (const connection of this.connections.values()) {
      stats.totalBytesReceived += connection.stats.bytesReceived;
      stats.totalBytesSent += connection.stats.bytesSent;
      stats.totalMessagesReceived += connection.stats.messagesReceived;
      stats.totalMessagesSent += connection.stats.messagesSent;
    }
    
    return {
      ...stats,
      timestamp: new Date().toISOString()
    };
  }

  // Test serial port communication
  async testPort(portPath) {
    try {
      console.log(`🧪 Testing serial port: ${portPath}`);
      
      // Try to connect
      const connectResult = await this.connectToPort(portPath, { baudRate: 9600 });
      if (!connectResult.success) {
        return { success: false, error: `Failed to connect: ${connectResult.error}` };
      }
      
      // Wait a bit for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send test data
      const testData = 'TEST\n';
      const sendResult = await this.sendData(portPath, testData);
      
      // Wait for potential response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Disconnect
      await this.disconnectFromPort(portPath);
      
      return {
        success: true,
        message: 'Port test completed successfully',
        testData: testData,
        sendResult: sendResult
      };
      
    } catch (error) {
      console.error(`❌ Error testing port ${portPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SerialManager();
