const SQLiteService = require('../database/sqliteService');
const natsClient = require('../nats/natsClient');
const { processPowerFlowData } = require('../../utils/powerFlowUtils');

class PowerFlowSocketService {
  constructor(io) {
    this.io = io;
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
      // Use the existing NATS client singleton instead of creating a new connection
      if (!natsClient.getConnectionStatus()) {
        console.log('⏳ NATS client not connected, waiting for connection...');
        // Wait for the main NATS client to connect
        let attempts = 0;
        while (!natsClient.getConnectionStatus() && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        if (!natsClient.getConnectionStatus()) {
          throw new Error('NATS client connection timeout');
        }
      }

      console.log('✅ Using existing NATS connection for real-time power flow data');

      // Subscribe to sensor data using the existing client
      const subscription = await natsClient.subscribe('sensor.data', (data) => {
        this.processPowerFlowData(data);
      });

      if (subscription) {
        this.isConnected = true;
        console.log('✅ Subscribed to sensor.data for real-time updates');
      } else {
        throw new Error('Failed to subscribe to sensor.data');
      }
      
    } catch (error) {
      console.error('❌ Failed to connect to NATS:', error);
      throw error;
    }
  }

  processPowerFlowData(sensorData) {
    try {
      // Use shared utility for consistent processing
      const result = processPowerFlowData(sensorData.data);

      // Prepare real-time data
      const realTimeData = {
        timestamp: sensorData.metadata?.timestamp || Date.now(),
        time: new Date(sensorData.metadata?.timestamp || Date.now()).toISOString(),
        solar: result.solar,
        grid: result.grid,
        genset: result.genset,
        load: result.load,
        batchId: sensorData.metadata?.batch_id,
        receivedDevices: result.receivedDevices,
        deviceCounts: result.deviceCounts, // Include device counts for debugging
        status: {
          solar: result.solar > 0 ? 'Active' : 'Inactive',
          grid: result.grid > 0 ? 'Active' : 'Inactive',
          genset: result.genset > 0 ? 'Running' : 'Stopped',
          load: result.load > 0 ? 'Active' : 'No Load'
        }
      };

      // Emit real-time data to all connected clients
      this.io.emit('power-flow-update', realTimeData);
      
      // Enhanced logging with device counts
      const deviceSummary = Object.entries(result.deviceCounts)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${type}:${count}`)
        .join(', ');
      
      console.log(`⚡ Real-time Power Flow [${deviceSummary}]: Solar=${result.solar}W, Grid=${result.grid}W, Genset=${result.genset}W, Load=${result.load}W`);
      
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
      // Unsubscribe from NATS using the singleton client
      if (this.isConnected) {
        natsClient.unsubscribe('sensor.data');
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
