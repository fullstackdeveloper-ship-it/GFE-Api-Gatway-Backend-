# 🚀 GFE API Gateway Backend

A clean and simple Node.js backend API for the Green Project IoT system.

## 📋 What This Project Does

This backend handles:
- **Device Management** - Manage IoT devices (inverters, generators, power meters)
- **Real-time Data** - Stream sensor data via WebSockets and NATS
- **Authentication** - Secure API access
- **Power Flow Monitoring** - Track energy production and consumption
- **Network Management** - Monitor network connectivity and interfaces

## 🏗️ Project Structure (Simple & Clean)

```
src/
├── api/routes/           # 🌐 API Routes (Simple & Clean)
│   ├── auth.js          # Login/logout endpoints
│   ├── devices.js       # Device management endpoints
│   ├── connectivity.js  # Network testing endpoints
│   ├── parameters.js    # Device parameter endpoints
│   └── powerFlow.js     # Power flow data endpoints
│
├── modules/
│   ├── controllers/     # 🎯 Business Logic Controllers
│   │   ├── auth/        # Authentication logic
│   │   ├── devices/     # Device management logic
│   │   ├── connectivity/ # Network testing logic
│   │   ├── parameters/  # Parameter management logic
│   │   └── powerFlow/   # Power flow logic
│   │
│   ├── services/        # 🔧 Core Services
│   │   ├── auth/        # Authentication service
│   │   ├── database/    # Database operations
│   │   ├── devices/     # Device data management
│   │   ├── nats/        # Message queuing
│   │   ├── socket/      # Real-time WebSocket
│   │   └── network/     # Network management
│   │
│   └── server/          # 🖥️ Server Setup
│       └── server.js    # Main server configuration
│
└── app.js              # 🚀 Application Entry Point
```

## 🎯 How It Works (Simple Flow)

```
1. 📡 Request comes to Route
2. 🎯 Route calls Controller
3. 🔧 Controller calls Service
4. 💾 Service handles Database/External APIs
5. 📤 Response sent back to Client
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# or
node src/app.js
```

### 3. Test the API
```bash
# Health check
curl http://localhost:5001/health

# Get devices
curl http://localhost:5001/api/devices
```

## 📡 API Endpoints

### 🔐 Authentication
- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout

### 📱 Device Management
- `GET /api/devices` - Get all devices
- `POST /api/devices` - Add new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `GET /api/devices/power-meters` - Get power meter devices

### 🌐 Network Testing
- `GET /api/connectivity/test/:ip` - Test device connectivity
- `GET /api/connectivity/status` - Get connectivity status

### ⚙️ Device Parameters
- `GET /api/parameters/:deviceName` - Get device parameters
- `POST /api/parameters/:deviceName` - Update device parameters

### ⚡ Power Flow
- `GET /api/power-flow/data` - Get power flow data
- `GET /api/power-flow/realtime` - Get real-time power flow

### 🖥️ System Monitoring
- `GET /health` - Health check
- `GET /api/memory` - Memory usage
- `GET /api/disk` - Disk usage
- `GET /api/ping` - Ping test

## 🔧 Configuration

### Environment Variables
```bash
# Server
PORT=5001
HOST=0.0.0.0

# NATS (Message Queue)
NATS_URL=nats://nats_user:change_me@192.168.3.100:4222
NATS_TOPIC=sensor.data

# Database
DB_PATH=/path/to/database.db
```

### Device Configuration
- Device definitions: `gfe-iot/devices/device.yaml`
- Blueprint templates: `gfe-iot/blueprints/`

## 🧪 Testing

### Test with Dummy Data
```bash
# Send test sensor data
node push.js
```

### Test WebSocket Connection
```javascript
// Connect to WebSocket
const socket = io('http://localhost:5001');

// Listen for device data
socket.on('device_data', (data) => {
  console.log('Received:', data);
});
```

## 🛠️ Development

### Adding New Routes (Simple Steps)

1. **Create Route** in `src/api/routes/`
```javascript
// src/api/routes/example.js
const express = require('express');
const router = express.Router();
const exampleController = require('../../modules/controllers/example/exampleController');

router.get('/test', (req, res) => {
  exampleController.getTest(req, res);
});

module.exports = router;
```

2. **Create Controller** in `src/modules/controllers/example/`
```javascript
// src/modules/controllers/example/exampleController.js
class ExampleController {
  async getTest(req, res) {
    try {
      // Your business logic here
      res.json({ message: 'Test successful' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ExampleController();
```

3. **Register Route** in `src/modules/server/server.js`
```javascript
// Add this line in setupRoutes()
this.app.use('/api/example', routes.example);
```

4. **Add Route Export** in `src/api/routes/index.js`
```javascript
module.exports = {
  auth: require('./auth'),
  devices: require('./devices'),
  connectivity: require('./connectivity'),
  parameters: require('./parameters'),
  powerFlow: require('./powerFlow'),
  example: require('./example')  // Add this line
};
```

## 📊 Real-time Features

### WebSocket Events
- `device_data` - Real-time device sensor data
- `power_flow_update` - Real-time power flow updates
- `connectivity_status` - Network connectivity updates

### NATS Integration
- Subscribes to `sensor.data` topic
- Processes incoming sensor data
- Broadcasts to connected WebSocket clients

## 🔍 Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Kill process using port 5001
sudo lsof -ti:5001 | xargs kill -9
```

2. **Database Connection Issues**
```bash
# Check database file exists
ls -la /path/to/database.db
```

3. **NATS Connection Issues**
```bash
# Check NATS server is running
telnet 192.168.3.100 4222
```

## 📝 Logs

The application logs important events:
- 🚀 Server startup
- 📡 API requests
- 🔌 NATS connections
- 💾 Database operations
- ⚠️ Errors and warnings

## 🤝 Contributing

1. Follow the simple route → controller → service pattern
2. Keep routes clean and simple (no .bind() functions)
3. Add proper error handling
4. Test your changes with `node push.js`

## 📄 License

This project is part of the Green Project IoT system.

---

**Made Simple for Junior Developers! 🎯**
