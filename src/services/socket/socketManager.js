class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientCount = 0;
  }

  init(io) {
    this.io = io;
    
    this.io.on('connection', (socket) => {
      console.log(`🔌 New client connected: ${socket.id}`);
      this.clientCount++;
      
      // Store client information
      this.connectedClients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
      
      // Handle client disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.clientCount--;
        this.connectedClients.delete(socket.id);
      });
      
      // Handle custom events
      socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📱 Client ${socket.id} joined room: ${room}`);
      });
      
      socket.on('leave-room', (room) => {
        socket.leave(room);
        console.log(`📱 Client ${socket.id} left room: ${room}`);
      });
      
      // Handle sensor data requests
      socket.on('request-sensor-data', () => {
        console.log(`📊 Client ${socket.id} requested sensor data`);
        // You can implement sensor data retrieval here
        socket.emit('sensor-data', {
          message: 'Sensor data requested',
          timestamp: new Date().toISOString()
        });
      });
      
      // Handle network interface requests
      socket.on('request-network-info', async () => {
        console.log(`🌐 Client ${socket.id} requested network information`);
        try {
          const networkManager = require('../network/networkManager');
          const allInterfaces = await networkManager.getAllInterfaces();
          socket.emit('network-info', allInterfaces);
        } catch (error) {
          console.error(`Error getting network info for client ${socket.id}:`, error);
          socket.emit('network-info-error', { error: error.message });
        }
      });
      
      // Handle serial port requests
      socket.on('request-serial-info', () => {
        console.log(`🔌 Client ${socket.id} requested serial port information`);
        try {
          const serialManager = require('../serial/serialManager');
          const serialPorts = serialManager.getSerialPorts();
          socket.emit('serial-info', serialPorts);
        } catch (error) {
          console.error(`Error getting serial info for client ${socket.id}:`, error);
          socket.emit('serial-info-error', { error: error.message });
        }
      });
      
      // Send welcome message
      socket.emit('welcome', {
        message: 'Welcome to Green Project Backend',
        clientId: socket.id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📊 Total connected clients: ${this.clientCount}`);
    });
    
    console.log('✅ Socket.IO manager initialized');
  }

  getConnectedClientsCount() {
    return this.clientCount;
  }

  getConnectedClientsInfo() {
    return Array.from(this.connectedClients.values());
  }

  broadcastToAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
      console.log(`📡 Broadcasted ${event} to ${this.clientCount} clients`);
    }
  }

  broadcastToRoom(room, event, data) {
    if (this.io) {
      this.io.to(room).emit(event, data);
      console.log(`📡 Broadcasted ${event} to room ${room}`);
    }
  }

  sendToClient(clientId, event, data) {
    if (this.io) {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit(event, data);
        console.log(`📡 Sent ${event} to client ${clientId}`);
      } else {
        console.log(`⚠️  Client ${clientId} not found`);
      }
    }
  }

  broadcastSensorData(data) {
    console.log(`📊 Broadcasting sensor data to ${this.clientCount} clients:`);
    console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
    console.log(`   Event: sensor-data`);
    const sensorData = JSON.stringify(data);
    console.log(`   Sensor data: ${sensorData}`);
    
    if (this.io && this.clientCount > 0) {
      this.io.emit('sensor-data', data);
      console.log(`✅ Sensor data broadcasted successfully to ${this.clientCount} clients`);
    } else {
      console.log(`⚠️  No clients connected or Socket.IO not initialized`);
    }
  }


  broadcastSystemAlert(alert) {
    this.broadcastToAll('system-alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }

  // Get statistics about connected clients
  getClientStatistics() {
    const clients = Array.from(this.connectedClients.values());
    const now = new Date();
    
    return {
      total: this.clientCount,
      active: clients.filter(client => {
        const connectedTime = new Date(client.connectedAt);
        const minutesConnected = (now - connectedTime) / (1000 * 60);
        return minutesConnected < 60; // Consider active if connected less than 1 hour
      }).length,
      averageConnectionTime: clients.length > 0 ? 
        clients.reduce((total, client) => {
          const connectedTime = new Date(client.connectedAt);
          return total + (now - connectedTime);
        }, 0) / clients.length / (1000 * 60) : 0, // in minutes
      timestamp: now.toISOString()
    };
  }

  // Disconnect a specific client
  disconnectClient(clientId) {
    if (this.io) {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket) {
        socket.disconnect(true);
        console.log(`🔌 Forcibly disconnected client ${clientId}`);
        return true;
      }
    }
    return false;
  }

  // Disconnect all clients
  disconnectAllClients() {
    if (this.io) {
      this.io.disconnectSockets();
      console.log(`🔌 Disconnected all ${this.clientCount} clients`);
      this.clientCount = 0;
      this.connectedClients.clear();
    }
  }
}

module.exports = new SocketManager();
