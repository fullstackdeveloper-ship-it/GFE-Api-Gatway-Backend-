const { processPowerFlowData } = require('../../../utils/powerFlowUtils');

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientCount = 0;
    this.sensorRefCounts = new Map();
    this.previousPowerFlowData = {
      solar: 0,
      grid: 0,
      genset: 0,
      load: 0
    };
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
          this._incDeviceRef(deviceName);
        }
      });
      
      socket.on('leave-room', (room) => {
        socket.leave(room);
        console.log(`📱 Client ${socket.id} left room: ${room}`);

        if (room.startsWith('sensor:')) {
          const deviceName = room.split(':')[1];
          this._decDeviceRef(deviceName);
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

  emitSensorToDevice(deviceName, shortNameDict) {
    const room = this.sensorRoom(deviceName);
    if (!this.hasListeners(room)) {
      return false;
    }
    this.io.to(room).emit('sensor-data', shortNameDict);
    return true;
  }


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

      // Process power flow data from the same batch
      this.processPowerFlowData(arr, timestamp);
    } catch (e) {
      console.error('handleContinuousSensorStream error:', e);
    }
  }


  processPowerFlowData(sensorData, timestamp) {
    try {
      // Use shared utility for consistent processing
      const result = processPowerFlowData(sensorData);
      
      // Use previous values for device types not received in this batch
      const hasSolar = result.receivedDevices.includes('solar');
      const hasGrid = result.receivedDevices.includes('grid');
      const hasGenset = result.receivedDevices.includes('genset');
      
      const finalSolarPower = hasSolar ? result.solar : this.previousPowerFlowData.solar;
      const finalGridPower = hasGrid ? result.grid : this.previousPowerFlowData.grid;
      const finalGensetPower = hasGenset ? result.genset : this.previousPowerFlowData.genset;
      const finalLoadPower = finalSolarPower + finalGridPower + finalGensetPower;

      // Update previous values for next batch
      this.previousPowerFlowData = {
        solar: finalSolarPower,
        grid: finalGridPower,
        genset: finalGensetPower,
        load: finalLoadPower
      };

      // Prepare power flow data
      const powerFlowData = {
        solar: finalSolarPower,
        grid: finalGridPower,
        genset: finalGensetPower,
        load: finalLoadPower,
        timestamp: timestamp,
        receivedDevices: result.receivedDevices, // Track which devices sent data
        status: {
          solar: finalSolarPower > 0 ? 'Active' : 'Inactive',
          grid: finalGridPower > 0 ? 'Active' : 'Inactive',
          genset: finalGensetPower > 0 ? 'Running' : 'Stopped',
          load: finalLoadPower > 0 ? 'Active' : 'No Load'
        }
      };

      // Emit power flow data to subscribers
      this.emitPowerFlowData(powerFlowData);
      
      // Log the processing for debugging
      console.log(`⚡ Power Flow Processing: Received ${result.receivedDevices.length}/3 devices`);
      console.log(`📊 Final Values: Solar=${finalSolarPower}kW, Grid=${finalGridPower}kW, Genset=${finalGensetPower}kW, Load=${finalLoadPower}kW`);
    } catch (e) {
      console.error('processPowerFlowData error:', e);
    }
  }


  emitPowerFlowData(powerFlowData) {
    const room = 'power-flow';
    if (!this.hasListeners(room)) {
      // No subscribers; skip emit
      return false;
    }
    this.io.to(room).emit('power-flow-data', powerFlowData);
    return true;
  }


}

module.exports = new SocketManager();
