const { connect } = require('nats');
const PostgresService = require('./postgresService');

class PowerFlowSocketService {
  constructor(io) {
    this.io = io;
    this.natsClient = null;
    this.postgresService = new PostgresService();
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

      // Track which devices we received data for
      const receivedDevices = new Set();

      // Process each device in the batch
      for (const entry of sensorData.data) {
        const meta = entry.deviceMataData || entry.deviceMetaData || {};
        const deviceType = meta.device_type;
        const register = entry.register;

        if (!deviceType || !register) continue;

        // Solar Inverter
        if (deviceType === 'solar_inverter') {
          receivedDevices.add('solar');
          if (register.W) {
            solarPower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            solarPower = (parseFloat(register.WphA) || 0) + 
                        (parseFloat(register.WphB) || 0) + 
                        (parseFloat(register.WphC) || 0);
          }
        }
        // Power Meter (Grid)
        else if (deviceType === 'power_meter') {
          receivedDevices.add('grid');
          if (register.W) {
            gridPower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            gridPower = (parseFloat(register.WphA) || 0) + 
                       (parseFloat(register.WphB) || 0) + 
                       (parseFloat(register.WphC) || 0);
          }
        }
        // Genset Controller
        else if (deviceType === 'genset_controller') {
          receivedDevices.add('genset');
          if (register.W) {
            gensetPower = parseFloat(register.W) || 0;
          } else if (register.WphA && register.WphB && register.WphC) {
            gensetPower = (parseFloat(register.WphA) || 0) + 
                         (parseFloat(register.WphB) || 0) + 
                         (parseFloat(register.WphC) || 0);
          }
        }
      }

      // Calculate load
      loadPower = solarPower + gridPower + gensetPower;

      // Prepare real-time data
      const realTimeData = {
        timestamp: sensorData.metadata?.timestamp || Date.now(),
        time: new Date(sensorData.metadata?.timestamp || Date.now()).toISOString(),
        solar: solarPower,
        grid: gridPower,
        genset: gensetPower,
        load: loadPower,
        batchId: sensorData.metadata?.batch_id,
        receivedDevices: Array.from(receivedDevices),
        status: {
          solar: solarPower > 0 ? 'Active' : 'Inactive',
          grid: gridPower > 0 ? 'Active' : 'Inactive',
          genset: gensetPower > 0 ? 'Running' : 'Stopped',
          load: loadPower > 0 ? 'Active' : 'No Load'
        }
      };

      // Emit real-time data to all connected clients
      this.io.emit('power-flow-update', realTimeData);
      
      console.log(`⚡ Real-time Power Flow: Solar=${solarPower}kW, Grid=${gridPower}kW, Genset=${gensetPower}kW, Load=${loadPower}kW`);
      
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
          const result = await this.postgresService.getPowerFlowHistory(24);
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
          const result = await this.postgresService.getPowerFlowDataByTimeRange(startTime, endTime);
          
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
          const result = await this.postgresService.getPowerFlowStats(hours);
          
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
      
      if (this.postgresService) {
        await this.postgresService.close();
      }
      
      this.isConnected = false;
      console.log('✅ Power Flow Socket Service disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Power Flow Socket Service:', error);
    }
  }
}

module.exports = PowerFlowSocketService;
