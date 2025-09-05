const http = require('http');
const socketIo = require('socket.io');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;

// Import modules
const config = require('../config/settings');
const services = require('../services');
const routes = require('../../api/routes');
const middleware = require('../middleware');
const controllers = require('../controllers');

class Server {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Express middleware
      this.setupMiddleware();
      
      // Initialize Socket.IO
      this.initializeSocketIO();
      
      // Initialize services
      await this.initializeServices();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.initialized = true;
      console.log('✅ Server module initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize server module:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // CORS
    this.app.use(cors());
    
    // Morgan logging
    this.app.use(morgan('combined'));
    
    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, '../../../templates')));
  }

  initializeSocketIO() {
    this.io = socketIo(this.server, {
      cors: {
        origin: config.SOCKET_CORS_ORIGINS,
        methods: ["GET", "POST"]
      }
    });
    
    // Initialize socket manager
    services.socket.SocketManager.init(this.io);
    console.log('✅ Socket.IO initialized');
  }

  async initializeServices() {
    // Initialize Database Service first (critical for all other services)
    await this.initializeDatabaseService();
    
    // Initialize Auto Table Creation Service
    await this.initializeAutoTableCreationService();
    
    // Initialize NATS connection
    await this.initializeNatsConnection();
    
    // Initialize Power Flow Socket Service
    await this.initializePowerFlowSocketService();
  }

  async initializeDatabaseService() {
    try {
      const databaseService = services.database.DatabaseService.getInstance();
      console.log('✅ Database Service (Singleton) initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Database Service:', error);
      throw error;
    }
  }

  async initializeAutoTableCreationService() {
    try {
      const autoTableCreationService = new services.devices.AutoTableCreationService();
      await autoTableCreationService.initialize();
      console.log('✅ Auto Table Creation Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Auto Table Creation Service:', error);
      throw error;
    }
  }

  async initializeNatsConnection() {
    try {
      const natsClient = services.nats.NatsClient;
      await natsClient.connect();
      
      // Subscribe to sensor data
      await natsClient.subscribe(config.NATS_TOPIC, this.handleSensorData);
      console.log('✅ NATS connection initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize NATS connection:', error);
      throw error;
    }
  }

  async initializePowerFlowSocketService() {
    try {
      const powerFlowSocketService = new services.powerflow.PowerFlowSocketService(this.io);
      await powerFlowSocketService.connectToNats();
      console.log('✅ Power Flow Socket Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Power Flow Socket Service:', error);
      throw error;
    }
  }

  setupRoutes() {
    // Basic routes
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../../templates/index.html'));
    });

    // Health check
    this.app.get('/health', controllers.system.getHealth.bind(controllers.system));

    // Memory monitoring
    this.app.get('/api/memory', controllers.system.getMemoryUsage.bind(controllers.system));

    // Disk monitoring
    this.app.get('/api/disk', controllers.system.getDiskUsage.bind(controllers.system));

    // Database management
    this.app.get('/api/db/size', controllers.system.getDatabaseSize.bind(controllers.system));
    this.app.post('/api/db/cleanup', controllers.system.cleanupDatabase.bind(controllers.system));

    // Enhanced ping endpoint for connectivity check (uses HTTP instead of ICMP)
    this.app.get('/api/ping', controllers.system.ping.bind(controllers.system));

    // Config API endpoints
    this.app.get('/api/config', controllers.config.getConfig.bind(controllers.config));
    this.app.put('/api/config', controllers.config.updateConfig.bind(controllers.config));

    // Network interfaces API
    this.app.get('/api/net/ifaces', controllers.network.getInterfaces.bind(controllers.network));

    // Network connectivity API
    this.app.get('/api/net/connectivity', controllers.network.getConnectivity.bind(controllers.network));

    // Serial ports API
    this.app.get('/api/serial/ports', controllers.serial.getSerialPorts.bind(controllers.serial));
    this.app.get('/api/serial/supported', controllers.serial.getSupportedValues.bind(controllers.serial));

    // API routes
    this.app.use('/api/auth', routes.auth);
    this.app.use('/api/devices', routes.devices);
    this.app.use('/api/connectivity', routes.connectivity);
    this.app.use('/api/parameters', routes.parameters);
    this.app.use('/api/power-flow', routes.powerFlow);

    console.log('📡 API Routes registered: /api/auth, /api/devices, /api/connectivity, /api/parameters, /api/power-flow, /api/ping, /api/config, /api/net/ifaces, /api/net/connectivity, /api/serial/ports');
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Global error handler:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  handleSensorData(data) {
    try {
      // Process sensor data through socket manager
      services.socket.SocketManager.handleUpstreamSensorBatch(data);
    } catch (error) {
      console.error('Error handling sensor data:', error);
    }
  }


  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.server.listen(config.PORT, config.HOST, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Server running on http://${config.HOST}:${config.PORT}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Server stopped');
        resolve();
      });
    });
  }

  getApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }

  getIO() {
    return this.io;
  }
}

module.exports = Server;
