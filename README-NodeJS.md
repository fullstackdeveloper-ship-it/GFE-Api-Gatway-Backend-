# Green Project Backend - Node.js Version

## 🚀 **Complete Python to Node.js Conversion**

This is a complete conversion of your Python Flask backend to Node.js with Express, Socket.IO, and all the same functionality.

## 📋 **What Was Converted:**

### **Core Application**
- ✅ `main.py` → `src/app.js` (Express server with Socket.IO)
- ✅ `src/config/settings.py` → `src/config/settings.js`
- ✅ `src/services/network/network_manager.py` → `src/services/network/networkManager.js`
- ✅ `src/services/socket/socket_manager.py` → `src/services/socket/socketManager.js`
- ✅ `src/services/nats/nats_client.py` → `src/services/nats/natsClient.js`
- ✅ `src/services/serial/serial_manager.py` → `src/services/serial/serialManager.js`

### **Features Preserved**
- ✅ **All API routes** (`/net/ifaces`, `/serial/ports`, etc.)
- ✅ **Socket.IO WebSocket support**
- ✅ **NATS messaging integration**
- ✅ **Network interface management** (Debian 11 + ifupdown)
- ✅ **Serial port management**
- ✅ **Comprehensive console logging**
- ✅ **Error handling and validation**
- ✅ **Backward compatibility** (`/api/*` routes)

## 🛠️ **Setup Instructions**

### **1. Install Dependencies**
```bash
cd Green_Project/backend
npm install
```

### **2. Create Environment File**
Create a `.env` file in the backend directory:
```bash
# Express Configuration
EXPRESS_SECRET_KEY=your-secret-key-here
EXPRESS_HOST=0.0.0.0
EXPRESS_PORT=5001
EXPRESS_DEBUG=true

# NATS Configuration
NATS_URL=nats://edge:CHANGE_ME_STRONG@192.168.100.135:4222
NATS_TOPIC=sensor.data

# Socket.IO Configuration
SOCKET_CORS_ORIGINS=*

# Logging Configuration
LOG_LEVEL=info
```

### **3. Run the Backend**
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### **4. Test Console Logging**
```bash
# Test the NetworkManager console logging
npm test

# Test network functionality
npm run test-network
```

## 🔍 **Console Logging Features**

The Node.js version includes **exactly the same console logging** as your Python version:

- 🚀 **Real-time initialization logs**
- 📁 **Configuration file checks**
- 📡 **Command execution details**
- 📊 **Data processing steps**
- ⚠️ **Warnings and errors**
- ✅ **Success confirmations**

## 🌐 **API Endpoints**

### **Network Management**
- `GET /net/ifaces` - Get all network interfaces
- `GET /net/ifaces?only=eth0,eth1` - Get specific interfaces
- `PUT /net/ifaces/:name` - Update interface configuration

### **Serial Port Management**
- `GET /serial/ports` - Get available serial ports
- `PUT /serial/ports/:id` - Update serial port configuration
- `GET /serial/supported` - Get supported configuration values

### **System Information**
- `GET /health` - Health check with system status
- `GET /clients` - Connected WebSocket clients
- `GET /test-broadcast` - Test WebSocket broadcasting

### **Backward Compatibility**
- `GET /api/net/ifaces` → redirects to `/net/ifaces`
- `PUT /api/net/ifaces/:name` → redirects to `/net/ifaces/:name`
- `GET /api/serial/ports` → redirects to `/serial/ports`
- `PUT /api/serial/ports/:id` → redirects to `/serial/ports/:id`
- `GET /api/serial/supported` → redirects to `/serial/supported`

## 🔌 **WebSocket Events**

### **Client → Server**
- `request-sensor-data` - Request sensor data
- `request-network-info` - Request network information
- `request-serial-info` - Request serial port information
- `join-room` - Join a specific room
- `leave-room` - Leave a specific room

### **Server → Client**
- `welcome` - Welcome message on connection
- `sensor_data` - Sensor data updates
- `network-info` - Network interface information
- `serial-info` - Serial port information
- `network-update` - Network configuration updates
- `serial-update` - Serial port updates
- `system-alert` - System alerts and notifications

## 📊 **NetworkManager Features**

### **Interface Discovery**
- Automatic detection of network interfaces
- Support for Debian 11 ifupdown configuration
- Parsing of `/etc/network/interfaces` and `/etc/network/interfaces.d/`

### **Configuration Parsing**
- `iface` stanza parsing
- `auto` and `allow-hotplug` support
- IP address, netmask, gateway, DNS, MTU parsing
- Netmask to prefix length conversion

### **Runtime Information**
- Interface state (admin/operational)
- MAC address and MTU
- IPv4 addresses and routes
- Real-time statistics

## 🔧 **Development Commands**

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start

# Test console logging
npm test

# Test network functionality
npm run test-network

# Install development dependencies
npm install --save-dev nodemon
```

## 🐛 **Troubleshooting**

### **Common Issues**

1. **Permission Denied**
   ```bash
   # Network operations may require elevated privileges
   sudo npm start
   ```

2. **Port Already in Use**
   ```bash
   # Change port in .env file
   EXPRESS_PORT=5002
   ```

3. **NATS Connection Failed**
   ```bash
   # Check NATS server status
   # Update NATS_URL in .env file
   ```

4. **Serial Port Access**
   ```bash
   # Add user to dialout group
   sudo usermod -a -G dialout $USER
   ```

## 📈 **Performance Benefits**

- **Faster startup** - No Python interpreter overhead
- **Better memory management** - Node.js event loop
- **Native async/await** - Built-in promise support
- **Efficient JSON handling** - Native JavaScript objects
- **Better error handling** - Try-catch with async/await

## 🔄 **Migration Notes**

- **All Python logic preserved** - Exact same functionality
- **Same API endpoints** - No frontend changes needed
- **Same WebSocket events** - Socket.IO compatibility
- **Same configuration structure** - Environment variables
- **Same console logging** - Real-time monitoring

## 🎯 **Next Steps**

1. **Test the console logging** - Run `npm test` to see real-time output
2. **Verify API endpoints** - Test all routes with your frontend
3. **Check WebSocket connections** - Ensure real-time updates work
4. **Monitor performance** - Compare with Python version
5. **Deploy to production** - Use `npm start` for production

## 📞 **Support**

The Node.js backend maintains **100% compatibility** with your existing frontend and provides the same rich console logging for debugging network operations on Debian 11 with ifupdown.
