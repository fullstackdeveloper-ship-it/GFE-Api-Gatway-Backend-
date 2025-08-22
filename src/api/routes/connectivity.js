const express = require('express');
const { execFile } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execFileAsync = util.promisify(execFile);

const router = express.Router();

// Configuration
const CONNECTION_TESTER_PATH = '/home/edge/shared_status_manager/build/connection_tester';
const SERIAL_INTERFACE_MAP = {
  'serial_1': '/dev/ttyS4',
  'serial_2': '/dev/ttyS5'
};

/**
 * Test device connectivity using external connection_tester binary
 * Supports both TCP (Modbus-TCP) and Serial (Modbus-RTU) testing
 */
router.post('/test-connectivity', async (req, res) => {
  try {
    const { type, protocol, name, target, timeoutMs = 5000 } = req.body;

    console.log(`🧪 Testing device connectivity:`, { type, protocol, name, target, timeoutMs });

    // Validate required fields
    if (!type || !protocol || !target) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, protocol, and target are required'
      });
    }

    let testResult;

    if (type === 'tcp') {
      testResult = await testTCPConnectivity(protocol, name, target, timeoutMs);
    } else if (type === 'serial') {
      testResult = await testSerialConnectivity(protocol, name, target, timeoutMs);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid test type. Must be "tcp" or "serial"'
      });
    }

    console.log(`✅ Connectivity test completed:`, testResult);
    res.json(testResult);

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
 * Test TCP connectivity using connection_tester binary
 */
async function testTCPConnectivity(protocol, name, target, timeoutMs) {
  try {
    console.log(`🔍 Testing TCP connectivity: ${protocol} to ${target.ip}:${target.port || 502}`);

    // Validate TCP target
    if (!target.ip) {
      throw new Error('IP address is required for TCP connectivity test');
    }

    const port = target.port || 502;
    const deviceName = name || `TCP_${target.ip}_${port}`;
    const targetString = `${target.ip}:${port}`;

    // Build command arguments - Only 3 arguments: name, protocol, IP (no port)
    const args = [deviceName, protocol, target.ip];
    
    console.log(`🚀 Executing: ${CONNECTION_TESTER_PATH} ${args.join(' ')}`);

    // Execute connection_tester with timeout
    const startTime = Date.now();
    const { stdout, stderr } = await execFileAsync(CONNECTION_TESTER_PATH, args, {
      timeout: timeoutMs + 1000,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    const durationMs = Date.now() - startTime;

    // Parse the JSON response from stdout
    let testResult;
    try {
      testResult = JSON.parse(stdout.trim());
    } catch (parseError) {
      console.error('Failed to parse connection_tester output:', parseError);
      testResult = { status: 'failed', error: 'Invalid response format' };
    }

    // Determine success based on the parsed result
    const isSuccess = testResult.status === 'success' || testResult.status === 'passed' || testResult.status === 'connected';

    return {
      success: isSuccess,
      type: 'tcp',
      protocol: protocol,
      target: targetString,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      durationMs: durationMs,
      timestamp: new Date().toISOString(),
      // Include the parsed result details
      deviceName: testResult.device_name,
      responseTime: testResult.response_time_ms,
      status: testResult.status,
      error: testResult.error,
      value: testResult.value
    };

  } catch (error) {
    console.error(`❌ TCP connectivity test failed:`, error);
    
    // Try to parse stdout for error details even when command fails
    let testResult = { status: 'failed', error: 'Unknown error' };
    if (error.stdout) {
      try {
        testResult = JSON.parse(error.stdout.trim());
      } catch (parseError) {
        console.error('Failed to parse error output:', parseError);
      }
    }
    
    // Handle specific error types
    let userMessage = 'TCP connectivity test failed';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.code === 'ENOENT') {
      userMessage = 'Connection tester binary not found';
      errorCode = 'BINARY_NOT_FOUND';
    } else if (error.code === 'EACCES') {
      userMessage = 'Permission denied for connection tester';
      errorCode = 'PERMISSION_DENIED';
    } else if (error.code === 'ETIMEDOUT') {
      userMessage = 'Connection test timed out';
      errorCode = 'TIMEOUT';
    } else if (error.code === 'ENOTFOUND') {
      userMessage = 'Target address not found';
      errorCode = 'ADDRESS_NOT_FOUND';
    } else if (error.code === 'ECONNREFUSED') {
      userMessage = 'Connection refused by target';
      errorCode = 'CONNECTION_REFUSED';
    } else if (error.code === 1 && testResult.error) {
      // Use the actual error message from the binary
      userMessage = testResult.error;
      errorCode = 'DEVICE_ERROR';
    }
    
    return {
      success: false,
      type: 'tcp',
      protocol: protocol,
      target: `${target.ip}:${target.port || 502}`,
      error: userMessage,
      details: testResult.error || error.message,
      errorCode: errorCode,
      timestamp: new Date().toISOString(),
      // Include the parsed result details
      deviceName: testResult.device_name,
      responseTime: testResult.response_time_ms,
      status: testResult.status,
      value: testResult.value
    };
  }
}

/**
 * Test Serial connectivity using connection_tester binary
 */
async function testSerialConnectivity(protocol, name, target, timeoutMs) {
  try {
    console.log(`🔍 Testing Serial connectivity: ${protocol} on ${target.interface}`);

    // Validate serial target - accept both frontend names and actual device paths
    const validInterfaces = ['serial_1', 'serial_2', '/dev/ttyS4', '/dev/ttyS5'];
    if (!target.interface || !validInterfaces.includes(target.interface)) {
      throw new Error('Invalid interface. Must be "serial_1", "serial_2", "/dev/ttyS4", or "/dev/ttyS5"');
    }

    // Map interface names to actual device paths
    const devicePathMapping = {
      'serial_1': '/dev/ttyS4',
      'serial_2': '/dev/ttyS5',
      '/dev/ttyS4': '/dev/ttyS4',
      '/dev/ttyS5': '/dev/ttyS5'
    };
    
    const devicePath = devicePathMapping[target.interface];
    const deviceName = name || `Serial_${target.interface}`;
    const deviceId = target.deviceId || '';

    // Check if serial interface exists and is accessible
    await validateSerialInterface(devicePath);

    // Build command arguments - Only 3 arguments: name, protocol, devicePath (no deviceId)
    const args = [deviceName, protocol, devicePath];
    
    console.log(`🚀 Executing: ${CONNECTION_TESTER_PATH} ${args.join(' ')}`);

    // Execute connection_tester with timeout
    const startTime = Date.now();
    const { stdout, stderr } = await execFileAsync(CONNECTION_TESTER_PATH, args, {
      timeout: timeoutMs + 1000,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    const durationMs = Date.now() - startTime;

    // Parse the JSON response from stdout
    let testResult;
    try {
      testResult = JSON.parse(stdout.trim());
    } catch (parseError) {
      console.error('Failed to parse connection_tester output:', parseError);
      testResult = { status: 'failed', error: 'Invalid response format' };
    }

    // Determine success based on the parsed result
    const isSuccess = testResult.status === 'success' || testResult.status === 'passed' || testResult.status === 'connected';

    return {
      success: isSuccess,
      type: 'serial',
      protocol: protocol,
      target: devicePath,
      interface: target.interface,
      deviceId: deviceId,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      durationMs: durationMs,
      timestamp: new Date().toISOString(),
      // Include the parsed result details
      deviceName: testResult.device_name,
      responseTime: testResult.response_time_ms,
      status: testResult.status,
      error: testResult.error,
      value: testResult.value
    };

  } catch (error) {
    console.error(`❌ Serial connectivity test failed:`, error);
    
    // Try to parse stdout for error details even when command fails
    let testResult = { status: 'failed', error: 'Unknown error' };
    if (error.stdout) {
      try {
        testResult = JSON.parse(error.stdout.trim());
      } catch (parseError) {
        console.error('Failed to parse error output:', parseError);
      }
    }
    
    // Handle specific error types
    let userMessage = 'Serial connectivity test failed';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.code === 'ENOENT') {
      userMessage = 'Connection tester binary not found';
      errorCode = 'BINARY_NOT_FOUND';
    } else if (error.code === 'EACCES') {
      userMessage = 'Permission denied for connection tester';
      errorCode = 'PERMISSION_DENIED';
    } else if (error.code === 'ETIMEDOUT') {
      userMessage = 'Serial communication timed out';
      errorCode = 'TIMEOUT';
    } else if (error.code === 'SERIAL_INTERFACE_NOT_FOUND') {
      userMessage = 'Serial interface not found or not accessible';
      errorCode = 'INTERFACE_NOT_FOUND';
    } else if (error.code === 1 && testResult.error) {
      // Use the actual error message from the binary
      userMessage = testResult.error;
      errorCode = 'DEVICE_ERROR';
    }
    
    return {
      success: false,
      type: 'serial',
      protocol: protocol,
      target: target.interface || 'unknown',
      interface: target.interface,
      error: userMessage,
      details: testResult.error || error.message,
      errorCode: errorCode,
      timestamp: new Date().toISOString(),
      // Include the parsed result details
      deviceName: testResult.device_name,
      responseTime: testResult.response_time_ms,
      status: testResult.status,
      value: testResult.value
    };
  }
}

/**
 * Validate serial interface exists and is accessible
 */
async function validateSerialInterface(devicePath) {
  try {
    // Check if device file exists
    await fs.access(devicePath);
    
    // Check if we have read/write permissions
    const stats = await fs.stat(devicePath);
    const mode = stats.mode;
    const isReadable = (mode & fs.constants.R_OK) !== 0;
    const isWritable = (mode & fs.constants.W_OK) !== 0;
    
    if (!isReadable || !isWritable) {
      throw new Error(`Serial interface ${devicePath} lacks read/write permissions`);
    }
    
    console.log(`✅ Serial interface ${devicePath} is accessible`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      const customError = new Error(`Serial interface ${devicePath} does not exist`);
      customError.code = 'SERIAL_INTERFACE_NOT_FOUND';
      throw customError;
    } else if (error.code === 'EACCES') {
      const customError = new Error(`Access denied to serial interface ${devicePath}`);
      customError.code = 'SERIAL_INTERFACE_NOT_FOUND';
      throw customError;
    }
    throw error;
  }
}

/**
 * Health check endpoint for connectivity service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'connectivity-testing',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /test-connectivity - Test device connectivity using connection_tester',
      'GET /health - Service health check'
    ],
    binary: CONNECTION_TESTER_PATH,
    supportedProtocols: ['modbus_tcp', 'modbus_rtu'],
    serialInterfaces: Object.keys(SERIAL_INTERFACE_MAP)
  });
});

module.exports = router;
