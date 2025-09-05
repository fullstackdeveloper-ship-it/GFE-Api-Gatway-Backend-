/**
 * Shared utility functions for power flow calculations
 * Used by both socket services and database handlers to ensure consistency
 */

/**
 * Check if a value is null or "null" string
 */
function isNullValue(value) {
  return value === null || value === undefined || value === "null" || value === "";
}

/**
 * Parse a power value, returning 0 for null/invalid values
 */
function parsePowerValue(value) {
  if (isNullValue(value)) {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate device power from register data, skipping null values
 */
function calculateDevicePower(register) {
  let devicePower = 0;
  
  // Try single W value first
  if (register.W !== undefined && !isNullValue(register.W)) {
    devicePower = parsePowerValue(register.W);
  }
  // If W is null or missing, try three-phase values
  else if (register.WphA !== undefined && register.WphB !== undefined && register.WphC !== undefined) {
    const phaseA = isNullValue(register.WphA) ? 0 : parsePowerValue(register.WphA);
    const phaseB = isNullValue(register.WphB) ? 0 : parsePowerValue(register.WphB);
    const phaseC = isNullValue(register.WphC) ? 0 : parsePowerValue(register.WphC);
    
    // Only use phase values if at least one is not null
    if (!isNullValue(register.WphA) || !isNullValue(register.WphB) || !isNullValue(register.WphC)) {
      devicePower = phaseA + phaseB + phaseC;
    }
  }
  
  return devicePower;
}

/**
 * Process power flow data consistently across services
 */
function processPowerFlowData(sensorData, options = {}) {
  let solarPower = 0;
  let gridPower = 0;
  let gensetPower = 0;
  
  // Track which devices we received data for
  const receivedDevices = new Set();
  
  // Track device counts for logging
  const deviceCounts = {
    solar_inverter: 0,
    power_meter: 0,
    genset_controller: 0
  };

  // Process each device in the batch
  for (const entry of sensorData) {
    const meta = entry.deviceMataData || entry.deviceMetaData || {};
    const deviceType = meta.device_type;
    const register = entry.register;

    if (!deviceType || !register) continue;

    // Count devices by type
    if (deviceCounts.hasOwnProperty(deviceType)) {
      deviceCounts[deviceType]++;
    }

    const devicePower = calculateDevicePower(register);
    
    // Only process if we got valid power data (not all null)
    if (devicePower > 0 || (!isNullValue(register.W) || 
        !isNullValue(register.WphA) || !isNullValue(register.WphB) || !isNullValue(register.WphC))) {
      
      // Solar Inverter - SUM all solar devices
      if (deviceType === 'solar_inverter') {
        receivedDevices.add('solar');
        solarPower += devicePower;
      }
      // Power Meter (Grid) - SUM all grid devices
      else if (deviceType === 'power_meter') {
        receivedDevices.add('grid');
        gridPower += devicePower;
      }
      // Genset Controller - SUM all genset devices
      else if (deviceType === 'genset_controller') {
        receivedDevices.add('genset');
        gensetPower += devicePower;
      }
    }
  }

  // Calculate total load (sum of all power sources)
  const loadPower = solarPower + gridPower + gensetPower;

  return {
    solar: Math.round(solarPower * 100) / 100,
    grid: Math.round(gridPower * 100) / 100,
    genset: Math.round(gensetPower * 100) / 100,
    load: Math.round(loadPower * 100) / 100,
    receivedDevices: Array.from(receivedDevices),
    deviceCounts: deviceCounts
  };
}

module.exports = {
  isNullValue,
  parsePowerValue,
  calculateDevicePower,
  processPowerFlowData
};
