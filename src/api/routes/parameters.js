const express = require('express');
const router = express.Router();
const ParametersController = require('../../modules/controllers/parameters/parametersController');

// Initialize parameters controller
const parametersController = new ParametersController();

/**
 * Set parameter value for a device
 * POST /api/parameters/set-value
 */
router.post('/set-value', async (req, res) => {
  try {
    const result = await parametersController.setParameterValue(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('❌ Parameter set-value error:', error);
    res.status(500).json({
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
    const result = await parametersController.getParameterHistory(deviceName, register);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('❌ Parameter history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching parameter history',
      details: error.message
    });
  }
});

module.exports = router;
