const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const DeviceTableService = require('./deviceTableService');
const config = require('../config/settings');

class AutoTableCreationService {
  constructor() {
    this.deviceTableService = new DeviceTableService();
    // Use config path, resolve relative to project root
    this.devicesYamlPath = path.resolve(config.DEVICES_YAML_PATH);
    console.log(`📁 Devices YAML path: ${this.devicesYamlPath}`);
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Auto Table Creation Service...');
      
      // Check if devices.yml exists
      if (!await this.devicesYamlFileExists()) {
        console.log('ℹ️ No devices.yml file found, skipping auto table creation');
        return;
      }

      // Load devices from YAML
      const devices = await this.loadDevicesFromYaml();
      if (!devices || devices.length === 0) {
        console.log('ℹ️ No devices found in devices.yml, skipping auto table creation');
        return;
      }

      console.log(`📋 Found ${devices.length} devices in devices.yml`);
      
      // Check and create tables for each device
      await this.checkAndCreateTables(devices);
      
      console.log('✅ Auto Table Creation Service initialized');
      
    } catch (error) {
      console.error('❌ Error initializing Auto Table Creation Service:', error.message);
      // Don't throw error - this service shouldn't prevent server startup
    }
  }

  async devicesYamlFileExists() {
    try {
      await fs.access(this.devicesYamlPath);
      return true;
    } catch {
      return false;
    }
  }

  async loadDevicesFromYaml() {
    try {
      const yamlContent = await fs.readFile(this.devicesYamlPath, 'utf8');
      const parsed = yaml.load(yamlContent);
      
      // Handle different YAML structures
      if (parsed.devices_list && Array.isArray(parsed.devices_list)) {
        return parsed.devices_list;
      } else if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.devices && Array.isArray(parsed.devices)) {
        return parsed.devices;
      } else {
        console.log('⚠️ Unexpected devices.yml structure, attempting to parse as device list...');
        // Try to parse as a direct list of devices
        return [parsed];
      }
    } catch (error) {
      console.error('❌ Error loading devices.yml:', error.message);
      return [];
    }
  }

  async checkAndCreateTables(devices) {
    const results = {
      created: [],
      alreadyExist: [],
      failed: []
    };

    for (const device of devices) {
      try {
        const deviceName = device.device_name;
        const reference = device.reference;
        
        if (!deviceName || !reference) {
          console.log(`⚠️ Skipping device with missing name or reference:`, device);
          continue;
        }

        console.log(`🔍 Checking table for device: ${deviceName} (${reference})`);
        
        // Check if table already exists
        const tableExists = await this.deviceTableService.tableExists(deviceName);
        
        if (tableExists) {
          console.log(`✅ Table already exists for ${deviceName}`);
          results.alreadyExist.push(deviceName);
        } else {
          console.log(`📝 Creating table for ${deviceName}...`);
          
          // Create the table
          const tableName = await this.deviceTableService.createDeviceTable(deviceName, reference);
          
          if (tableName) {
            console.log(`✅ Successfully created table ${tableName} for ${deviceName}`);
            results.created.push(deviceName);
          } else {
            console.log(`❌ Failed to create table for ${deviceName}`);
            results.failed.push(deviceName);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing device ${device.device_name || 'unknown'}:`, error.message);
        results.failed.push(device.device_name || 'unknown');
      }
    }

    // Log summary
    console.log('\n📊 Auto Table Creation Summary:');
    console.log(`   ✅ Created: ${results.created.length} tables`);
    console.log(`   ℹ️ Already Exist: ${results.alreadyExist.length} tables`);
    console.log(`   ❌ Failed: ${results.failed.length} tables`);
    
    if (results.created.length > 0) {
      console.log(`   📝 Newly Created: ${results.created.join(', ')}`);
    }
    
    if (results.failed.length > 0) {
      console.log(`   ❌ Failed Devices: ${results.failed.join(', ')}`);
    }
  }

  async shutdown() {
    try {
      if (this.deviceTableService) {
        await this.deviceTableService.close();
      }
      console.log('✅ Auto Table Creation Service shutdown complete');
    } catch (error) {
      console.error('❌ Error during Auto Table Creation Service shutdown:', error.message);
    }
  }
}

module.exports = AutoTableCreationService;
