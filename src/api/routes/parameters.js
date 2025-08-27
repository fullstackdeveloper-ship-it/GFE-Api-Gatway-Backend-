const express = require('express');
const router = express.Router();
const natsService = require('../../services/natsService');

/**
 * Set parameter value for a device
 * POST /api/parameters/set-value
 */
router.post('/set-value', async (req, res) => {
  try {
    const { device_name, device_type, reference, register, value } = req.body;

    // Validate required fields
    if (!device_name || !device_type || !reference || !register || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_name, device_type, reference, register, and value are required'
      });
    }

    // Validate value is a number
    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      return res.status(400).json({
        success: false,
        error: 'Value must be a valid number'
      });
    }

    // Prepare the payload for NATS
    const natsPayload = {
      device_name,
      device_type,
      reference,
      register,
      value: numericValue,
      timestamp: new Date().toISOString()
    };

    // Publish to NATS topic (read from environment variable)
    const topic = process.env.NATS_CONTROL_RESPONSE_TOPIC || 'control.response';
    
    try {
      await natsService.publish(topic, natsPayload);
      
      console.log(`✅ Parameter value set successfully for device: ${device_name}, register: ${register}, value: ${numericValue}`);
      console.log(`📡 Published to NATS topic: ${topic}`);
      
      return res.status(200).json({
        success: true,
        message: `Parameter value set successfully for ${device_name}`,
        data: {
          device_name,
          register,
          value: numericValue,
          timestamp: natsPayload.timestamp
        }
      });
      
    } catch (natsError) {
      console.error('❌ NATS publish error:', natsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to publish parameter value to control system',
        details: natsError.message
      });
    }

  } catch (error) {
    console.error('❌ Parameter set-value error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while setting parameter value',
      details: error.message
    });
  }
});

/**
 * Get parameter value history (optional - for future use)
 * GET /api/parameters/history/:deviceName/:register
 */
router.get('/history/:deviceName/:register', async (req, res) => {
  try {
    const { deviceName, register } = req.params;
    
    // This could be implemented to fetch parameter history from a database
    // For now, returning a placeholder response
    
    return res.status(200).json({
      success: true,
      message: 'Parameter history endpoint - to be implemented',
      data: {
        device_name: deviceName,
        register,
        history: []
      }
    });
    
  } catch (error) {
    console.error('❌ Parameter history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching parameter history',
      details: error.message
    });
  }
});

module.exports = router;
