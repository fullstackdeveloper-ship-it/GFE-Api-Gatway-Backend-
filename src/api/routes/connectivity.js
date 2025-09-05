const express = require('express');
const ConnectivityController = require('../../modules/controllers/connectivity/connectivityController');

const router = express.Router();

// Initialize connectivity controller
const connectivityController = new ConnectivityController();

/**
 * Test device connectivity using external connection_tester binary
 * Supports both TCP (Modbus-TCP) and Serial (Modbus-RTU) testing
 */
router.post('/test-connectivity', async (req, res) => {
  try {
    const result = await connectivityController.testConnectivity(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error(`❌ Connectivity test failed:`, error);
    res.status(500).json({
      success: false,
      error: 'Connectivity test failed',
      details: error.message,
      errorCode: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check endpoint for connectivity service
 */
router.get('/health', (req, res) => {
  const result = connectivityController.getHealthStatus();
  res.json(result);
});

module.exports = router;
