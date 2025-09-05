const express = require('express');
const router = express.Router();
const serialController = require('../../modules/controllers/serial/serialController');

/**
 * GET /api/serial/ports
 * Get all available serial ports
 */
router.get('/ports', (req, res) => {
  serialController.getSerialPorts(req, res);
});

/**
 * GET /api/serial/supported
 * Get supported serial port values
 */
router.get('/supported', (req, res) => {
  serialController.getSupportedValues(req, res);
});

/**
 * PUT /api/serial/ports/:deviceId
 * Update serial port configuration (legacy endpoint)
 */
router.put('/ports/:deviceId', (req, res) => {
  serialController.updateSerialPort(req, res);
});

/**
 * PUT /api/serial-ports/:portName
 * Update serial port configuration (COM1, COM2, etc.)
 */
router.put('/:portName', (req, res) => {
  serialController.updateSerialPortConfig(req, res);
});

module.exports = router;
