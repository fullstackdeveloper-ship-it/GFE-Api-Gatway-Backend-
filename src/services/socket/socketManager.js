class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientCount = 0;

    // NEW: track room listener counts for sensor devices
    this.sensorRefCounts = new Map(); // deviceName -> count
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

        const rooms = [...socket.rooms].filter(r => r.startsWith('sensor:'));
        for (const room of rooms) {
          const deviceName = room.split(':')[1];
          const count = this._decDeviceRef(deviceName);
          console.log(`➖ (disconnect) sensor:${deviceName} refCount = ${count}`);
        }
      });
      
      // Handle custom events
      socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📱 Client ${socket.id} joined room: ${room}`);

        if (room.startsWith('sensor:')) {
          const deviceName = room.split(':')[1];
          const count = this._incDeviceRef(deviceName);
          console.log(`➕ sensor:${deviceName} refCount = ${count}`);
          // TODO (optional): ensure upstream for deviceName starts here
        }
      });
      
      socket.on('leave-room', (room) => {
        socket.leave(room);
        console.log(`📱 Client ${socket.id} left room: ${room}`);

        if (room.startsWith('sensor:')) {
          const deviceName = room.split(':')[1];
          const count = this._decDeviceRef(deviceName);
          console.log(`➖ sensor:${deviceName} refCount = ${count}`);
          // TODO (optional): if count === 0, stop upstream for deviceName
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

  // NEW: helpers
  sensorRoom(deviceName) {
    return `sensor:${deviceName}`;
  }
  
  hasListeners(room) {
    if (!this.io) return false;
    const set = this.io.sockets?.adapter?.rooms?.get(room);
    return !!set && set.size > 0;
  }
  
  _incDeviceRef(deviceName) {
    const n = (this.sensorRefCounts.get(deviceName) || 0) + 1;
    this.sensorRefCounts.set(deviceName, n);
    return n;
  }
  
  _decDeviceRef(deviceName) {
    const cur = this.sensorRefCounts.get(deviceName) || 0;
    const n = Math.max(0, cur - 1);
    if (n === 0) this.sensorRefCounts.delete(deviceName); else this.sensorRefCounts.set(deviceName, n);
    return n;
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

  // NEW: emit only if there are listeners for that device's room
  emitSensorToDevice(deviceName, shortNameDict) {
    const room = this.sensorRoom(deviceName);
    if (!this.hasListeners(room)) {
      // No subscribers; skip noisy emits
      // console.log(`🕳️ No listeners for ${room}, skipping emit`);
      return false;
    }
    this.io.to(room).emit('sensor-data', shortNameDict);
    // console.log(`📡 Emitted sensor-data to ${room}`);
    return true;
  }

  /**
   * NEW: Accepts upstream payloads of shape:
   * {
   *   data: [
   *     {
   *       deviceMataData: { device_name: "test", ... }, // note: sometimes deviceMetaData
   *       register: { Hz: "50", W: "0", ... }           // SHORT NAME DICT
   *     }
   *   ],
   *   metadata: { ... }
   * }
   */
  handleUpstreamSensorBatch(payload) {
    try {
      const arr = Array.isArray(payload?.data) ? payload.data : [];
      console.log(`📊 Processing ${arr.length} sensor entries...`);
      
      for (const entry of arr) {
        const meta = entry.deviceMataData || entry.deviceMetaData || {};
        const deviceName = meta.device_name || meta.deviceName || meta.name;
        const dict = entry.register;

        if (!deviceName || !dict || typeof dict !== 'object') {
          console.log(`⚠️ Skipping invalid entry: deviceName=${deviceName}, dict=${typeof dict}`);
          continue;
        }

        console.log(`📡 Emitting data for device: ${deviceName}`);
        // Only emit to subscribers of this device
        this.emitSensorToDevice(deviceName, dict);
      }
    } catch (e) {
      console.error('handleUpstreamSensorBatch error:', e);
    }
  }

  /**
   * NEW: Handle continuous sensor data streaming
   * This method can be called repeatedly for continuous updates
   */
  handleContinuousSensorStream(payload) {
    try {
      const arr = Array.isArray(payload?.data) ? payload.data : [];
      
      // Handle timestamp properly - convert string timestamps to numbers
      let timestamp = Date.now(); // Default to current time
      if (payload?.metadata?.timestamp) {
        const rawTimestamp = payload.metadata.timestamp;
        // Convert string timestamp to number if needed
        if (typeof rawTimestamp === 'string') {
          const parsed = parseInt(rawTimestamp);
          if (!isNaN(parsed)) {
            timestamp = parsed;
          }
        } else if (typeof rawTimestamp === 'number') {
          timestamp = rawTimestamp;
        }
      }
      
      // Validate timestamp before using it
      const dateObj = new Date(timestamp);
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠️ Invalid timestamp: ${payload?.metadata?.timestamp}, using current time`);
        timestamp = Date.now();
      }
      
      console.log(`🔄 Continuous stream: Processing ${arr.length} sensors at ${new Date(timestamp).toISOString()}`);
      
      for (const entry of arr) {
        const meta = entry.deviceMataData || entry.deviceMetaData || {};
        const deviceName = meta.device_name || meta.deviceName || meta.name;
        const dict = entry.register;

        if (!deviceName || !dict || typeof dict !== 'object') continue;

        // Add timestamp to the data for frontend tracking
        const enrichedData = {
          ...dict,
          _timestamp: timestamp,
          _deviceName: deviceName
        };

        // Only emit to subscribers of this device
        this.emitSensorToDevice(deviceName, enrichedData);
      }
    } catch (e) {
      console.error('handleContinuousSensorStream error:', e);
    }
  }




}

module.exports = new SocketManager();
