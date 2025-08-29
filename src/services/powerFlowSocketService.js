const { connect } = require('nats');
const SQLiteService = require('./sqliteService');

class PowerFlowSocketService {
  constructor(io) {
    this.io = io;
    this.natsClient = null;
    this.sqliteService = new SQLiteService();
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Power Flow Socket Service...');
      
      // Connect to NATS
      await this.connectToNats();
      
      // Setup socket events
      this.setupSocketEvents();
      
      console.log('✅ Power Flow Socket Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Power Flow Socket Service:', error);
      throw error;
    }
  }

  async connectToNats() {
    try {
      const config = {
        servers: process.env.NATS_URL || 'nats://localhost:4222',
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000
      };

      // Add authentication if credentials are provided
      if (process.env.NATS_USER && process.env.NATS_PASSWORD) {
        config.user = process.env.NATS_USER;
        config.pass = process.env.NATS_PASSWORD;
      }

      this.natsClient = await connect(config);
      console.log('✅ Connected to NATS for real-time power flow data');

      // Subscribe to sensor data
      const subscription = this.natsClient.subscribe('sensor.data', {
        callback: (err, msg) => {
          if (err) {
            console.error('❌ NATS message error:', err);
            return;
          }
          
          try {
            const data = JSON.parse(msg.data);
            this.processPowerFlowData(data);
          } catch (parseError) {
            console.error('❌ Error parsing NATS message:', parseError);
          }
        }
      });

      this.isConnected = true;
      console.log('✅ Subscribed to sensor.data for real-time updates');
      
    } catch (error) {
      console.error('❌ Failed to connect to NATS:', error);
      throw error;
    }
  }

  processPowerFlowData(sensorData) {
    try {
      let solarPower = 0;
      let gridPower = 0;
      let gensetPower = 0;
      let loadPower = 0;

      // Track which device types we received data for
      const receivedDevices = new Set();
      
      // Track individual device counts for logging
      const deviceCounts = {
        solar_inverter: 0,
        power_meter: 0,
        genset_controller: 0
      };

      // Process each device in the batch
      for (const entry of sensorData.data) {
        const meta = entry.deviceMataData || entry.deviceMetaData || {};
        const deviceType = meta.device_type;
        const register = entry.register;

        if (!deviceType || !register) continue;

        // Count devices by type
        if (deviceCounts.hasOwnProperty(deviceType)) {
          deviceCounts[deviceType]++;
        }

        // Solar Inverter - SUM all solar devices
        if (deviceType === 'solar_inverter') {
          receivedDevices.add('solar');
          let devicePower = 0;
          
          if (register.W) {
            devicePower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            devicePower = (parseFloat(register.WphA) || 0) + 
                         (parseFloat(register.WphB) || 0) + 
                         (parseFloat(register.WphC) || 0);
          }
          
          solarPower += devicePower;
        }
        
        // Power Meter (Grid) - SUM all grid devices
        else if (deviceType === 'power_meter') {
          receivedDevices.add('grid');
          let devicePower = 0;
          
          if (register.W) {
            devicePower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            devicePower = (parseFloat(register.WphA) || 0) + 
                         (parseFloat(register.WphB) || 0) + 
                         (parseFloat(register.WphC) || 0);
          }
          
          gridPower += devicePower;
        }
        
        // Genset Controller - SUM all genset devices
        else if (deviceType === 'genset_controller') {
          receivedDevices.add('genset');
          let devicePower = 0;
          
          if (register.W) {
            devicePower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            devicePower = (parseFloat(register.WphA) || 0) + 
                         (parseFloat(register.WphB) || 0) + 
                         (parseFloat(register.WphC) || 0);
          }
          
          gensetPower += devicePower;
        }
      }

      // Calculate total load (sum of all power sources)
      loadPower = solarPower + gridPower + gensetPower;

      // Prepare real-time data
      const realTimeData = {
        timestamp: sensorData.metadata?.timestamp || Date.now(),
        time: new Date(sensorData.metadata?.timestamp || Date.now()).toISOString(),
        solar: Math.round(solarPower * 100) / 100, // Round to 2 decimal places
        grid: Math.round(gridPower * 100) / 100,
        genset: Math.round(gensetPower * 100) / 100,
        load: Math.round(loadPower * 100) / 100,
        batchId: sensorData.metadata?.batch_id,
        receivedDevices: Array.from(receivedDevices),
        deviceCounts: deviceCounts, // Include device counts for debugging
        status: {
          solar: solarPower > 0 ? 'Active' : 'Inactive',
          grid: gridPower > 0 ? 'Active' : 'Inactive',
          genset: gensetPower > 0 ? 'Running' : 'Stopped',
          load: loadPower > 0 ? 'Active' : 'No Load'
        }
      };

      // Emit real-time data to all connected clients
      this.io.emit('power-flow-update', realTimeData);
      
      // Enhanced logging with device counts
      const deviceSummary = Object.entries(deviceCounts)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${type}:${count}`)
        .join(', ');
      
      console.log(`⚡ Real-time Power Flow [${deviceSummary}]: Solar=${solarPower}W, Grid=${gridPower}W, Genset=${gensetPower}W, Load=${loadPower}W`);
      
    } catch (error) {
      console.error('❌ Error processing real-time power flow data:', error);
    }
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Send initial data when client connects
      socket.on('get-initial-data', async () => {
        try {
          const result = await this.sqliteService.getPowerFlowHistory(24);
          if (result.success) {
            socket.emit('power-flow-history', {
              success: true,
              data: result.data,
              count: result.count
            });
          }
        } catch (error) {
          console.error('❌ Error sending initial data:', error);
          socket.emit('power-flow-history', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle client requests for specific time ranges
      socket.on('get-data-range', async (data) => {
        try {
          const { startTime, endTime } = data;
          const result = await this.sqliteService.getPowerFlowDataByTimeRange(startTime, endTime);
          
          socket.emit('power-flow-range', {
            success: result.success,
            data: result.data,
            count: result.count
          });
        } catch (error) {
          console.error('❌ Error sending range data:', error);
          socket.emit('power-flow-range', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle client requests for statistics
      socket.on('get-stats', async (data) => {
        try {
          const hours = data.hours || 24;
          const result = await this.sqliteService.getPowerFlowStats(hours);
          
          socket.emit('power-flow-stats', {
            success: result.success,
            data: result.data
          });
        } catch (error) {
          console.error('❌ Error sending stats:', error);
          socket.emit('power-flow-stats', {
            success: false,
            error: error.message
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  async disconnect() {
    try {
      if (this.natsClient) {
        await this.natsClient.drain();
        this.natsClient.close();
      }
      
          if (this.sqliteService) {
      await this.sqliteService.close();
    }
      
      this.isConnected = false;
      console.log('✅ Power Flow Socket Service disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Power Flow Socket Service:', error);
    }
  }
}

module.exports = PowerFlowSocketService;
