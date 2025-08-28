require('dotenv').config();

const config = {
  // Express Configuration
  SECRET_KEY: process.env.EXPRESS_SECRET_KEY || 'your-secret-key-here',
  HOST: process.env.EXPRESS_HOST || '0.0.0.0',
  PORT: parseInt(process.env.EXPRESS_PORT) || 5001,
  DEBUG: process.env.EXPRESS_DEBUG === 'true',
  
  // Authentication Configuration
  DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD || '12345678',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key-here',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // NATS Configuration
  NATS_URL: process.env.NATS_URL || 'nats://edge:CHANGE_ME_STRONG@192.168.100.135:4222',
  NATS_TOPIC: process.env.NATS_TOPIC || 'sensor.data',
  
  // Socket.IO Configuration
  SOCKET_CORS_ORIGINS: process.env.SOCKET_CORS_ORIGINS || '*',
  SOCKET_ASYNC_MODE: 'threading',
  
  // Database Configuration (if needed later)
  DATABASE_URL: process.env.DATABASE_URL || null,
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
};

module.exports = config;
