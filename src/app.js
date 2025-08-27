const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
require('dotenv').config();

const execAsync = util.promisify(exec);

// Import services
const socketManager = require('./services/socket/socketManager');
const natsClient = require('./services/nats/natsClient');
const networkManager = require('./services/network/networkManager');
const serialManager = require('./services/serial/serialManager');

const deviceRoutes = require('./api/routes/devices');
const connectivityRoutes = require('./api/routes/connectivity');
const parametersRoutes = require('./api/routes/parameters');
// const serialRoutes = require('./api/routes/serial');

// Import configuration
const config = require('./config/settings');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: config.SOCKET_CORS_ORIGINS,
    methods: ["GET", "POST"]
  }
});

// Initialize socket manager
socketManager.init(io);

// Config file path
const CONFIG_FILE_PATH = path.join(__dirname, '../data/app-config.json');

// Ensure config directory exists
async function ensureConfigDirectory() {
  const configDir = path.dirname(CONFIG_FILE_PATH);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

// Default config
const DEFAULT_CONFIG = {
  siteName: 'Green Project',
  language: 'en',
  timezone: 'UTC',
  deviceTime: null,
  theme: 'light'
};

// Read config from file
async function readConfig() {
  try {
    await ensureConfigDirectory();
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, create with default config
    if (error.code === 'ENOENT') {
      await writeConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

// Write config to file
async function writeConfig(configData) {
  await ensureConfigDirectory();
  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(configData, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../templates')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    nats_connected: natsClient.getConnectionStatus(),
    clients_connected: socketManager.getConnectedClientsCount(),
    clients_info: socketManager.getConnectedClientsInfo(),
    timestamp: new Date().toISOString()
  });
});

// Enhanced ping endpoint for connectivity check (uses HTTP instead of ICMP)
app.get('/api/ping', async (req, res) => {
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
});

// Config API endpoints
app.get('/api/config', async (req, res) => {
  try {
    const configData = await readConfig();
    res.json(configData);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const currentConfig = await readConfig();
    const updatedConfig = { ...currentConfig, ...req.body };
    await writeConfig(updatedConfig);
    res.json(updatedConfig);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Simple device time API endpoint (just saves to config)
app.post('/api/device-time', async (req, res) => {
  try {
    const { deviceTime, timezone } = req.body;
    if (!deviceTime) {
      return res.status(400).json({ error: 'Device time is required' });
    }

    // Update config with new device time
    const currentConfig = await readConfig();
    const updatedConfig = { ...currentConfig, deviceTime };
    if (timezone) {
      updatedConfig.timezone = timezone;
    }
    await writeConfig(updatedConfig);

    res.json({ 
      success: true, 
      message: 'Device time and timezone saved to configuration',
      deviceTime,
      timezone: timezone || updatedConfig.timezone
    });
  } catch (error) {
    console.error('Error setting device time:', error);
    res.status(500).json({ error: 'Failed to set device time' });
  }
});

// Simple system info endpoint
app.get('/api/system-info', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'System info endpoint available',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});



app.get('/clients', (req, res) => {
  res.json({
    clients: socketManager.getConnectedClientsInfo(),
    timestamp: new Date().toISOString()
  });
});

app.get('/test-broadcast', (req, res) => {
  const sampleData = {
    site: 'test-site',
    device: 'test-device',
    metric: 'temperature',
    value: 25.5,
    unit: 'C',
    ts: Date.now() / 1000,
    quality: 1,
    schema_ver: 'v1'
  };

  console.log(`🧪 Test broadcast requested - Connected clients: ${socketManager.getConnectedClientsCount()}`);
  socketManager.broadcastSensorData(sampleData);

  res.json({
    message: 'Test broadcast sent',
    data: sampleData,
    connectedClients: socketManager.getConnectedClientsCount(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/devices', deviceRoutes);
app.use('/api/connectivity', connectivityRoutes);
app.use('/api/parameters', parametersRoutes);
// app.use('/api/serial', serialRoutes);

// Network Management API Routes
app.get('/net/ifaces', async (req, res) => {
  try {
    const onlyParam = req.query.only;
    if (onlyParam) {
      // Filter by specific interfaces
      const requestedInterfaces = onlyParam.split(',').map(iface => iface.trim());
      const interfaces = [];
      
      try {
        for (const iface of requestedInterfaces) {
          if (networkManager.managedInterfaces && Array.isArray(networkManager.managedInterfaces) && networkManager.managedInterfaces.includes(iface)) {
            const interfaceInfo = await networkManager.getInterfaceInfo(iface);
            interfaces.push(interfaceInfo);
          }
        }

        res.json({ 
          interfaces,
          total_count: interfaces.length
        });
      } catch (error) {
        console.error('Error getting specific interfaces:', error);
        res.json({ 
          interfaces: [],
          total_count: 0
        });
      }
    } else {
      // Return all managed interfaces
      try {
        const result = await networkManager.getAllInterfaces();
        const response = {
          interfaces: Array.isArray(result.interfaces) ? result.interfaces : [],
          total_count: Array.isArray(result.interfaces) ? result.interfaces.length : 0,
          timestamp: new Date().toISOString()
        };

        res.json(response);
      } catch (error) {
        console.error('Error getting all interfaces:', error);
        res.json({
          interfaces: [],
          total_count: 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error(`Error getting network interfaces: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

app.put('/net/ifaces/:interfaceName', (req, res) => {
  try {
    const { interfaceName } = req.params;
    
    if (!networkManager.managedInterfaces || !Array.isArray(networkManager.managedInterfaces) || !networkManager.managedInterfaces.includes(interfaceName)) {
      return res.status(400).json({ 
        error: `Interface ${interfaceName} is not managed` 
      });
    }

    // Validate request data
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: "No data provided" });
    }

    // Validate required fields
    const validationResult = validateNetworkConfig(data);
    if (!validationResult.valid) {
      return res.status(400).json({ error: validationResult.error });
    }

    // Update interface
    const result = networkManager.updateInterface(interfaceName, data);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error(`Error updating network interface ${req.params.interfaceName}: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Serial Port Management API Routes
app.get('/serial/ports', async (req, res) => {
  try {
    const result = await serialManager.getSerialPorts();
    res.json(result);
  } catch (error) {
    console.error(`Error getting serial ports: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Additional alias endpoint requested by frontend
app.get('/api/serial-ports', async (req, res) => {
  try {
    const result = await serialManager.getSerialPorts();
    res.json(result);
  } catch (error) {
    console.error(`Error getting serial ports (alias): ${error}`);
    res.status(500).json({ error: error.message });
  }
});

app.put('/serial/ports/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const data = req.body;
    
    if (!data) {
      return res.status(400).json({ error: "No data provided" });
    }

    // Update serial port (legacy path)
    const result = await serialManager.updateSerialPort(deviceId, data);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error(`Error updating serial port ${req.params.deviceId}: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// New: Update COM1/COM2 configs via stty
app.put('/serial-ports/:portName', async (req, res) => {
  try {
    const { portName } = req.params; // COM1 or COM2
    const payload = req.body; // { baud, dataBits, stopBits, parity, mode }
    console.log('🔧 API: update serial-ports', { portName, payload });

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid or missing payload' });
    }

    const result = await serialManager.updateSerialPortConfig(portName, payload);
    if (result.success) {
      return res.json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('❌ API error updating serial-ports:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Alias under /api as requested
app.put('/api/serial-ports/:portName', (req, res) => {
  req.url = `/serial-ports/${req.params.portName}`;
  app._router.handle(req, res);
});

// Connectivity Status API Routes
app.get('/api/net/connectivity', async (req, res) => {
  try {
    const onlyParam = req.query.only;
    if (onlyParam) {
      // Filter by specific interfaces
      const requestedInterfaces = onlyParam.split(',').map(iface => iface.trim());
      const results = {};
      
      for (const iface of requestedInterfaces) {
        if (networkManager.managedInterfaces && Array.isArray(networkManager.managedInterfaces) && networkManager.managedInterfaces.includes(iface)) {
          try {
            const connectivity = await networkManager.getConnectivityStatus(iface);
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
      
      for (const iface of networkManager.managedInterfaces) {
        try {
          const connectivity = await networkManager.getConnectivityStatus(iface);
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
    console.error(`Error getting connectivity status: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Alias for connectivity endpoint
app.get('/api/connectivity', (req, res) => {
  req.url = '/net/connectivity';
  app._router.handle(req, res);
});

app.get('/serial/supported', (req, res) => {
  try {
    const result = serialManager.getSupportedValues();
    res.json(result);
  } catch (error) {
    console.error(`Error getting supported serial values: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Keep the old /api routes for backward compatibility
app.get('/api/net/ifaces', (req, res) => {
  // Redirect to the new route
  req.url = '/net/ifaces';
  app._router.handle(req, res);
});

app.put('/api/net/ifaces/:interfaceName', (req, res) => {
  // Redirect to the new route
  req.url = `/net/ifaces/${req.params.interfaceName}`;
  app._router.handle(req, res);
});

app.get('/api/serial/ports', (req, res) => {
  // Redirect to the new route
  req.url = '/serial/ports';
  app._router.handle(req, res);
});

app.put('/api/serial/ports/:deviceId', (req, res) => {
  // Redirect to the new route
  req.url = `/serial/ports/${req.params.deviceId}`;
  app._router.handle(req, res);
});

app.get('/api/serial/supported', (req, res) => {
  // Redirect to the new route
  req.url = '/serial/supported';
  app._router.handle(req, res);
});

// Validation functions
function validateNetworkConfig(config) {
  try {
    // Validate apply_mode
    if (config.apply_mode) {
      if (!['runtime', 'persist', 'both'].includes(config.apply_mode)) {
        return { 
          valid: false, 
          error: "Invalid apply_mode. Must be 'runtime', 'persist', or 'both'" 
        };
      }
    }

    // Validate admin_state
    if (config.admin_state) {
      if (!['up', 'down'].includes(config.admin_state)) {
        return { 
          valid: false, 
          error: "Invalid admin_state. Must be 'up' or 'down'" 
        };
      }
    }

    // Validate method
    if (config.method) {
      if (!['dhcp', 'static'].includes(config.method)) {
        return { 
          valid: false, 
          error: "Invalid method. Must be 'dhcp' or 'static'" 
        };
      }
    }

    // Validate IPv4 configuration for static method
    if (config.method === 'static') {
      if (!config.ipv4) {
        return { 
          valid: false, 
          error: "IPv4 configuration required for static method" 
        };
      }

      const ipv4 = config.ipv4;
      if (!ipv4.address) {
        return { 
          valid: false, 
          error: "IPv4 address required for static method" 
        };
      }

      if (!ipv4.prefix) {
        return { 
          valid: false, 
          error: "IPv4 prefix required for static method" 
        };
      }

      // Validate IP address format
      if (!isValidIPv4(ipv4.address)) {
        return { 
          valid: false, 
          error: "Invalid IPv4 address format" 
        };
      }

      // Validate prefix
      if (!Number.isInteger(ipv4.prefix) || ipv4.prefix < 1 || ipv4.prefix > 32) {
        return { 
          valid: false, 
          error: "Invalid IPv4 prefix. Must be 1-32" 
        };
      }

      // Validate gateway if provided
      if (ipv4.gateway) {
        if (!isValidIPv4(ipv4.gateway)) {
          return { 
            valid: false, 
            error: "Invalid gateway IP address format" 
          };
        }
      }
    }

    // Validate DNS servers
    if (config.dns) {
      if (!Array.isArray(config.dns)) {
        return { 
          valid: false, 
          error: "DNS must be a list" 
        };
      }

      for (const dns of config.dns) {
        if (!isValidIPv4(dns)) {
          return { 
            valid: false, 
            error: `Invalid DNS server IP: ${dns}` 
          };
        }
      }
    }

    // Validate MTU
    if (config.mtu) {
      if (!Number.isInteger(config.mtu) || config.mtu < 68 || config.mtu > 9000) {
        return { 
          valid: false, 
          error: "Invalid MTU. Must be 68-9000" 
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Validation error: ${error.message}` 
    };
  }
}

function isValidIPv4(ip) {
  try {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        return false;
      }
      const num = parseInt(part);
      if (num < 0 || num > 255) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// Initialize NATS connection
async function initNatsConnection() {
  try {
    // Connect to NATS
    if (await natsClient.connect()) {
      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check connection status before subscribing
      if (natsClient.getConnectionStatus()) {
        // Subscribe to sensor data topic with retry
        let subscriptionSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`   Attempting NATS subscription (attempt ${attempt}/3)...`);
            await natsClient.subscribe(config.NATS_TOPIC, handleSensorData);
            subscriptionSuccess = true;
            console.log('NATS connection initialized successfully');
            break;
          } catch (subError) {
            console.log(`   Subscription attempt ${attempt} failed: ${subError.message}`);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!subscriptionSuccess) {
          console.error('Failed to subscribe to NATS after 3 attempts');
        }
      } else {
        console.error('NATS connection not ready for subscription');
      }
    } else {
      console.error('Failed to connect to NATS');
    }
  } catch (error) {
    console.error(`NATS connection error: ${error}`);
  }
}

function handleSensorData(data) {
  try {
    console.log(`📨 Received message on sensor.data: ${JSON.stringify(data, null, 2)}`);
    console.log(`📊 Connected clients: ${socketManager.getConnectedClientsCount()}`);

    // Use the continuous streaming method for real-time updates
    socketManager.handleContinuousSensorStream(data);

    // You can add more processing here (database storage, analytics, etc.)
  } catch (error) {
    console.error(`Error processing sensor data: ${error}`);
  }
}

// Start the server
async function startServer() {
  try {
    console.log('Starting Green Project Backend...');
    console.log(`Environment: ${config.DEBUG ? 'Development' : 'Production'}`);
    console.log(`Host: ${config.HOST}`);
    console.log(`Port: ${config.PORT}`);
    console.log(`NATS URL: ${config.NATS_URL}`);
    console.log(`NATS Topic: ${config.NATS_TOPIC}`);

    // Initialize NATS connection
    await initNatsConnection();

    // Start the server
    server.listen(config.PORT, config.HOST, () => {
      console.log(`Server running on http://${config.HOST}:${config.PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  try {
    await natsClient.disconnect();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error(`Error during shutdown: ${error}`);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = { app, server };
