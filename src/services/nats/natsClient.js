const { connect, StringCodec } = require('nats');

class NatsClient {
  constructor() {
    this.nc = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.connectionPromise = null;
  }

  async connect() {
    if (this.connected && this.nc) {
      console.log('✅ Already connected to NATS');
      return true;
    }

    if (this.connectionPromise) {
      console.log('⏳ NATS connection already in progress...');
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    try {
      console.log('🔌 Connecting to NATS...');
      
      // Parse NATS URL from environment
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      console.log(`   NATS URL: ${natsUrl}`);
      
      // Parse URL and connect with separate credentials (the working method)
      console.log(`   Connecting with parsed credentials...`);
      const url = new URL(natsUrl);
      const host = `${url.protocol}//${url.host}`;
      const user = url.username;
      const pass = url.password;
      
      console.log(`   Host: ${host}, User: ${user || 'none'}`);
      
      this.nc = await connect({
        servers: host,
        user: user || undefined,
        pass: pass || undefined,
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: 5
      });
      
      console.log(`   ✅ NATS connection successful!`);
      this.connected = true;
      
      // Set up connection event handlers
      this.nc.closed().then(() => {
        console.log('🔌 NATS connection closed');
        this.connected = false;
        this.nc = null;
      });
      
      this.nc.closed().catch((err) => {
        console.error('❌ NATS connection error:', err);
        this.connected = false;
        this.nc = null;
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to connect to NATS:', error.message);
      console.error('   Error details:', error);
      console.error('   Error stack:', error.stack);
      this.connected = false;
      this.nc = null;
      this.connectionPromise = null;
      return false;
    }
  }

  async disconnect() {
    if (!this.nc || !this.connected) {
      console.log('ℹ️  Not connected to NATS');
      return;
    }

    try {
      console.log('🔌 Disconnecting from NATS...');
      
      // Close all subscriptions
      for (const [subject, subscription] of this.subscriptions) {
        subscription.unsubscribe();
        console.log(`   Unsubscribed from: ${subject}`);
      }
      this.subscriptions.clear();
      
      // Close the connection
      await this.nc.drain();
      await this.nc.close();
      
      this.connected = false;
      this.nc = null;
      this.connectionPromise = null;
      
      console.log('✅ Disconnected from NATS successfully');
      
    } catch (error) {
      console.error('❌ Error disconnecting from NATS:', error.message);
    }
  }

  async subscribe(subject, callback) {
    if (!this.nc || !this.connected) {
      console.error('❌ Cannot subscribe: not connected to NATS');
      return false;
    }

    try {
      console.log(`📡 Subscribing to NATS subject: ${subject}`);
      
      const subscription = this.nc.subscribe(subject);
      this.subscriptions.set(subject, subscription);
      
      // Set up message handler
      (async () => {
        for await (const msg of subscription) {
          try {
            const data = StringCodec().decode(msg.data);
            const parsedData = JSON.parse(data);
            
            console.log(`📨 Received message on ${subject}:`, parsedData);
            
            // Call the callback with the parsed data
            if (typeof callback === 'function') {
              await callback(parsedData);
            }
            
          } catch (error) {
            console.error(`❌ Error processing message on ${subject}:`, error.message);
          }
        }
      })();
      
      console.log(`✅ Successfully subscribed to: ${subject}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${subject}:`, error.message);
      return false;
    }
  }

  async publish(subject, data) {
    if (!this.nc || !this.connected) {
      console.error('❌ Cannot publish: not connected to NATS');
      return false;
    }

    try {
      console.log(`📤 Publishing to NATS subject: ${subject}`);
      
      const encodedData = StringCodec().encode(JSON.stringify(data));
      this.nc.publish(subject, encodedData);
      
      console.log(`✅ Successfully published to: ${subject}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to publish to ${subject}:`, error.message);
      return false;
    }
  }

  async request(subject, data, timeout = 5000) {
    if (!this.nc || !this.connected) {
      console.error('❌ Cannot make request: not connected to NATS');
      return null;
    }

    try {
      console.log(`📤 Making request to NATS subject: ${subject}`);
      
      const encodedData = StringCodec().encode(JSON.stringify(data));
      const response = await this.nc.request(subject, encodedData, { timeout });
      
      const responseData = StringCodec().decode(response.data);
      const parsedResponse = JSON.parse(responseData);
      
      console.log(`✅ Received response from: ${subject}`);
      return parsedResponse;
      
    } catch (error) {
      console.error(`❌ Request to ${subject} failed:`, error.message);
      return null;
    }
  }

  getConnectionStatus() {
    return this.connected;
  }

  getConnectionInfo() {
    if (!this.nc) {
      return {
        connected: false,
        server: null,
        subscriptions: 0
      };
    }

    return {
      connected: this.connected,
      server: this.nc.getServer(),
      subscriptions: this.subscriptions.size,
      pendingMessages: this.nc.stats?.pending || 0
    };
  }

  // Health check method
  async healthCheck() {
    if (!this.connected) {
      return {
        status: 'disconnected',
        message: 'Not connected to NATS',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Try to publish a health check message
      await this.publish('health.check', {
        timestamp: new Date().toISOString(),
        service: 'green-project-backend'
      });

      return {
        status: 'healthy',
        message: 'NATS connection is working',
        timestamp: new Date().toISOString(),
        subscriptions: this.subscriptions.size
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get all active subscriptions
  getSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  // Unsubscribe from a specific subject
  unsubscribe(subject) {
    const subscription = this.subscriptions.get(subject);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subject);
      console.log(`📡 Unsubscribed from: ${subject}`);
      return true;
    }
    return false;
  }

  // Unsubscribe from all subjects
  unsubscribeAll() {
    for (const [subject, subscription] of this.subscriptions) {
      subscription.unsubscribe();
      console.log(`📡 Unsubscribed from: ${subject}`);
    }
    this.subscriptions.clear();
    console.log('📡 Unsubscribed from all subjects');
  }
}

module.exports = new NatsClient();
