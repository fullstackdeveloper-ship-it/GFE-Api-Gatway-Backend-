#!/usr/bin/env node

/**
 * Green Project Backend - Main Application Entry Point
 * Clean modular architecture with organized components
 */

const path = require('path');
const fs = require('fs').promises;

// Import modules
const Server = require('./modules/server/server');
const config = require('./modules/config/settings');

// Global variables
let server = null;

/**
 * Initialize application configuration
 */
async function initializeConfig() {
  try {
    const configDir = path.dirname(config.GLOBAL_DB_PATH);
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown() {
  console.log('\n🛑 Received shutdown signal, closing server gracefully...');
  
  try {
    if (server) {
      await server.stop();
    }
    
    // Close database connections
    const { DatabaseService } = require('./modules/services/database');
    const databaseService = DatabaseService.getInstance();
    await databaseService.close();
    
    // Disconnect NATS
    const { NatsClient } = require('./modules/services/nats');
    await NatsClient.disconnect();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Start the application
 */
async function startApplication() {
  try {
    console.log('🚀 Starting Green Project Backend...');
    console.log(`Environment: ${config.DEBUG ? 'Development' : 'Production'}`);
    console.log(`Host: ${config.HOST}`);
    console.log(`Port: ${config.PORT}`);
    console.log(`NATS URL: ${config.NATS_URL}`);
    console.log(`NATS Topic: ${config.NATS_TOPIC}`);
    console.log(`NATS Control Response Topic: ${process.env.NATS_CONTROL_RESPONSE_TOPIC || 'control.response'}`);

    // Initialize configuration
    await initializeConfig();

    // Create and start server
    server = new Server();
    await server.start();

  } catch (error) {
    console.error(`❌ Failed to start application: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start the application
if (require.main === module) {
  startApplication();
}

module.exports = { Server, startApplication, gracefulShutdown };
