const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Console logging function for real-time monitoring
function consoleLog(message, level = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

class NetworkManager {
  constructor() {
    consoleLog('🚀 Initializing NetworkManager for Debian 11 with ifupdown');
    this.interfacesFile = '/etc/network/interfaces';
    this.interfacesDir = '/etc/network/interfaces.d';
    this.resolvConf = '/etc/resolv.conf';
    this.managedInterfaces = ['eth1', 'wlan0']
    this.defaultDns = ['8.8.8.8', '1.1.1.1'];
    
    consoleLog(`📁 Configuration paths:`);
    consoleLog(`   Main interfaces file: ${this.interfacesFile}`);
    consoleLog(`   Interfaces directory: ${this.interfacesDir}`);
    consoleLog(`   Resolv config: ${this.resolvConf}`);
    consoleLog(`   Managed interfaces: ${this.managedInterfaces}`);
    
    // Check if configuration files exist (don't await in constructor)
    this.checkConfigFiles().catch(error => {
      consoleLog(`❌ Error in checkConfigFiles: ${error}`, 'ERROR');
    });
  }

  async checkConfigFiles() {
    consoleLog('🔍 Checking configuration files...');
    
    try {
      // Check main interfaces file
      try {
        const stats = await fs.stat(this.interfacesFile);
        consoleLog(`✅ Main interfaces file exists: ${this.interfacesFile}`);
        const content = await fs.readFile(this.interfacesFile, 'utf8');
        consoleLog(`   File size: ${content.length} characters`);
        const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
        consoleLog(`   Non-comment lines: ${lines.length}`);
      } catch (error) {
        consoleLog(`❌ Main interfaces file not found: ${this.interfacesFile}`, 'WARNING');
      }

      // Check interfaces.d directory
      try {
        const stats = await fs.stat(this.interfacesDir);
        consoleLog(`✅ Interfaces directory exists: ${this.interfacesDir}`);
        const files = await fs.readdir(this.interfacesDir);
        consoleLog(`   Files found: ${files.join(', ')}`);
      } catch (error) {
        consoleLog(`❌ Interfaces directory not found: ${this.interfacesDir}`, 'WARNING');
      }

      // Check resolv.conf
      try {
        const stats = await fs.stat(this.resolvConf);
        consoleLog(`✅ Resolv config exists: ${this.resolvConf}`);
      } catch (error) {
        consoleLog(`❌ Resolv config not found: ${this.resolvConf}`, 'WARNING');
      }

      consoleLog('🔍 Configuration file check completed');
    } catch (error) {
      consoleLog(`❌ Error checking configuration files: ${error}`, 'ERROR');
    }
  }

  async getInterfaceInfo(interfaceName) {
    consoleLog(`🔌 Getting interface info for: ${interfaceName}`);
  
    // Ensure managedInterfaces is valid
    if (!this.managedInterfaces || !Array.isArray(this.managedInterfaces)) {
      consoleLog(`⚠️ managedInterfaces not set, using defaults`, 'WARNING');
      this.managedInterfaces = ['eth1', 'wifi'];
    }
  
    if (!this.managedInterfaces.includes(interfaceName)) {
      consoleLog(`❌ Interface ${interfaceName} is not in managed list: ${this.managedInterfaces}`, 'ERROR');
      throw new Error(`Interface ${interfaceName} is not managed`);
    }
  
    try {
      consoleLog(`📡 Getting runtime information for ${interfaceName}...`);
      const runtimeInfo = await this.getRuntimeInfo(interfaceName);
  
      consoleLog(`✅ Retrieved: IP=${runtimeInfo.ip || 'N/A'}, Subnet=${runtimeInfo.subnet || 'N/A'}, Gateway=${runtimeInfo.gateway || 'N/A'}, DNS=${runtimeInfo.dns?.join(', ') || 'N/A'}`);
  
      return {
        ip: runtimeInfo.ip || '',
        subnet: runtimeInfo.subnet || '',
        gateway: runtimeInfo.gateway || '',
        dns: runtimeInfo.dns || []
      };
  
    } catch (error) {
      consoleLog(`❌ Failed to get info for ${interfaceName}: ${error}`, 'ERROR');
      return {
        ip: '',
        subnet: '',
        gateway: '',
        dns: []
      };
    }
  }
  

  async getRuntimeInfo(interfaceName) {
    consoleLog(`📡 Getting runtime info for interface: ${interfaceName}`);
  
    try {
      // --- IP + Subnet ---
      consoleLog(`🔍 Checking IP and subnet...`);
      const { stdout: addrStdout } = await execAsync(`ip -j addr show dev ${interfaceName}`);
      const addrData = JSON.parse(addrStdout);
      consoleLog(`✅ IP info retrieved: ${addrData.length} entry(ies) found`);
  
      if (!addrData.length) {
        consoleLog(`⚠️ No IP data found for ${interfaceName}`);
        return { ip: '', subnet: '', gateway: '', dns: [] };
      }
  
      const addrInfo = addrData[0].addr_info || [];
      const ipv4 = addrInfo.find(a => a.family === 'inet');
  
      const ip = ipv4 ? ipv4.local : '';
      const subnet = ipv4 ? ipv4.prefixlen : '';
      consoleLog(`   📄 IP Address: ${ip}/${subnet}`);
  
      // --- Gateway ---
      consoleLog(`🔍 Checking default gateway...`);
      const { stdout: routeStdout } = await execAsync(`ip route show default dev ${interfaceName}`);
      const routeMatch = routeStdout.match(/default via ([0-9.]+)/);
      const gateway = routeMatch ? routeMatch[1] : '';
      consoleLog(`   📄 Gateway: ${gateway || 'Not found'}`);
  
      // --- DNS ---
      consoleLog(`🔍 Checking DNS servers...`);
      const { stdout: resolvStdout } = await execAsync(`grep ^nameserver /etc/resolv.conf`);
      const dnsServers = resolvStdout
        .split('\n')
        .map(line => line.trim().split(/\s+/)[1])
        .filter(Boolean);
  
      if (dnsServers.length) {
        consoleLog(`   📄 DNS Servers: ${dnsServers.join(', ')}`);
      } else {
        consoleLog(`   ⚠️ No DNS servers found in /etc/resolv.conf`);
      }
  
      // --- Return clean object ---
      return {
        ip: ip,
        subnet: subnet,
        gateway: gateway,
        dns: dnsServers // [primary, secondary]
      };
  
    } catch (error) {
      consoleLog(`❌ Error getting runtime info for ${interfaceName}: ${error}`, 'ERROR');
      return { ip: '', subnet: '', gateway: '', dns: [] };
    }
  }

  /**
   * Check if interface has local/link connectivity
   * @param {string} interfaceName - Interface name (eth1, eth2, etc.)
   * @returns {Promise<{connected: boolean, details: string}>}
   */
  async checkLocalConnectivity(interfaceName) {
    consoleLog(`🔗 Checking local connectivity for ${interfaceName}...`);
    
    try {
      // Check if interface is up
      const { stdout: linkStdout } = await execAsync(`ip -j link show dev ${interfaceName}`);
      const linkData = JSON.parse(linkStdout);
      
      if (!linkData.length) {
        consoleLog(`   ❌ Interface ${interfaceName} not found`);
        return { connected: false, details: 'Interface not found' };
      }
      
      const linkState = linkData[0].operstate;
      consoleLog(`   📡 Link state: ${linkState}`);
      
      if (linkState !== 'UP') {
        consoleLog(`   ❌ Interface ${interfaceName} is not UP (state: ${linkState})`);
        return { connected: false, details: `Interface state: ${linkState}` };
      }
      
      // Check if interface has an IP address
      const runtimeInfo = await this.getRuntimeInfo(interfaceName);
      if (!runtimeInfo.ip) {
        consoleLog(`   ❌ Interface ${interfaceName} has no IP address`);
        return { connected: false, details: 'No IP address assigned' };
      }
      
      consoleLog(`   ✅ Interface ${interfaceName} is UP with IP ${runtimeInfo.ip}`);
      
      // Try to ping gateway if available
      if (runtimeInfo.gateway) {
        try {
          consoleLog(`   🔍 Testing gateway connectivity: ${runtimeInfo.gateway}`);
          await execAsync(`ping -c 1 -W 2 -I ${interfaceName} ${runtimeInfo.gateway}`, { timeout: 5000 });
          consoleLog(`   ✅ Gateway ${runtimeInfo.gateway} is reachable`);
          return { connected: true, details: `Connected to gateway ${runtimeInfo.gateway}` };
        } catch (error) {
          consoleLog(`   ⚠️ Gateway ${runtimeInfo.gateway} not reachable: ${error.message}`);
          return { connected: true, details: `Connected (IP: ${runtimeInfo.ip}) but gateway unreachable` };
        }
      }
      
      return { connected: true, details: `Connected (IP: ${runtimeInfo.ip})` };
      
    } catch (error) {
      consoleLog(`❌ Error checking local connectivity for ${interfaceName}: ${error.message}`, 'ERROR');
      return { connected: false, details: `Error: ${error.message}` };
    }
  }

  /**
   * Check if interface can reach the internet
   * @param {string} interfaceName - Interface name (eth1, eth2, etc.)
   * @returns {Promise<{reachable: boolean, details: string}>}
   */
  async checkInternetReachability(interfaceName) {
    consoleLog(`🌐 Checking internet reachability for ${interfaceName}...`);
    
    try {
      // First check if interface is locally connected
      const localStatus = await this.checkLocalConnectivity(interfaceName);
      if (!localStatus.connected) {
        consoleLog(`   ❌ Interface ${interfaceName} not locally connected`);
        return { reachable: false, details: 'Not locally connected' };
      }
      
      // Test DNS resolution
      try {
        consoleLog(`   🔍 Testing DNS resolution...`);
        await execAsync(`nslookup google.com`, { timeout: 5000 });
        consoleLog(`   ✅ DNS resolution working`);
      } catch (error) {
        consoleLog(`   ❌ DNS resolution failed: ${error.message}`);
        return { reachable: false, details: 'DNS resolution failed' };
      }
      
      // Test connectivity to public IP (8.8.8.8)
      try {
        consoleLog(`   🔍 Testing public IP connectivity: 8.8.8.8`);
        await execAsync(`ping -c 1 -W 3 -I ${interfaceName} 8.8.8.8`, { timeout: 8000 });
        consoleLog(`   ✅ Public IP 8.8.8.8 is reachable`);
      } catch (error) {
        consoleLog(`   ❌ Public IP 8.8.8.8 not reachable: ${error.message}`);
        return { reachable: false, details: 'Public IP unreachable' };
      }
      
      // Test connectivity to a domain (google.com)
      try {
        consoleLog(`   🔍 Testing domain connectivity: google.com`);
        await execAsync(`ping -c 1 -W 3 -I ${interfaceName} google.com`, { timeout: 8000 });
        consoleLog(`   ✅ Domain google.com is reachable`);
        return { reachable: true, details: 'Internet accessible' };
      } catch (error) {
        consoleLog(`   ⚠️ Domain google.com not reachable: ${error.message}`);
        return { reachable: true, details: 'Internet accessible (IP only)' };
      }
      
    } catch (error) {
      consoleLog(`❌ Error checking internet reachability for ${interfaceName}: ${error.message}`, 'ERROR');
      return { reachable: false, details: `Error: ${error.message}` };
    }
  }

  /**
   * Get comprehensive connectivity status for an interface
   * @param {string} interfaceName - Interface name (eth1, eth2, etc.)
   * @returns {Promise<{local: {connected: boolean, details: string}, internet: {reachable: boolean, details: string}}>}
   */
  async getConnectivityStatus(interfaceName) {
    consoleLog(`🔍 Getting comprehensive connectivity status for ${interfaceName}...`);
    
    try {
      const [localStatus, internetStatus] = await Promise.all([
        this.checkLocalConnectivity(interfaceName),
        this.checkInternetReachability(interfaceName)
      ]);
      
      consoleLog(`   📊 ${interfaceName} - Local: ${localStatus.connected ? '✅' : '❌'}, Internet: ${internetStatus.reachable ? '✅' : '❌'}`);
      
      return {
        local: localStatus,
        internet: internetStatus
      };
      
    } catch (error) {
      consoleLog(`❌ Error getting connectivity status for ${interfaceName}: ${error.message}`, 'ERROR');
      return {
        local: { connected: false, details: `Error: ${error.message}` },
        internet: { reachable: false, details: `Error: ${error.message}` }
      };
    }
  }
  

  async getInterfaceRoutes(interfaceName) {
    // consoleLog(`🛣️  Getting routes for interface: ${interfaceName}`);
    // consoleLog(`   Executing: ip -j route show dev ${interfaceName}`);
    
    try {
      const { stdout, stderr } = await execAsync(`ip -j route show dev ${interfaceName}`);
      // consoleLog(`   Route command executed successfully`);
      // consoleLog(`   Route stdout length: ${stdout.length} characters`);
      
      const routesData = JSON.parse(stdout);
      // consoleLog(`   Route JSON parsed, entries: ${routesData.length}`);
      
      const routes = [];
      for (const route of routesData) {
        const dst = route.dst || '';
        const gateway = route.gateway || '';
        routes.push({ dst, via: gateway });
      }
      
      return routes;
      
    } catch (error) {
      // const errorMsg = `Error getting routes for ${interfaceName}: ${error}`;
      // consoleLog(`   ❌ ${errorMsg}`, 'ERROR');
      return [];
    }
  }

  async getDefaultGateway(interfaceName) {
    // consoleLog(`🧭 Getting default gateway for interface: ${interfaceName}`);
    try {
      // Global route table, then filter default for this interface
      const { stdout } = await execAsync('ip -j route show');
      const data = JSON.parse(stdout);
      if (Array.isArray(data)) {
        const match = data.find(r => r.dst === 'default' && r.dev === interfaceName);
        const gw = match && match.gateway ? match.gateway : '';
        // consoleLog(`   Default gateway: ${gw || 'none'}`);
        return gw || '';
      }
      return '';
    } catch (error) {
      // consoleLog(`   ❌ Failed to get default gateway for ${interfaceName}: ${error.message}`, 'ERROR');
      return '';
    }
  }

  async getPersistedConfig(interfaceName) {
    // consoleLog(`📁 Getting persisted configuration for ${interfaceName}`);
    
    try {
      // Default configuration structure
      const defaultConfig = {
        method: 'dhcp',
        address: '',
        prefix: 24,
        gateway: '',
        dns: this.defaultDns.slice(),
        mtu: 1500
      };
      // consoleLog(`   Default config: ${JSON.stringify(defaultConfig)}`);
      
      // Check interfaces.d directory first
      const interfaceFile = path.join(this.interfacesDir, interfaceName);
      // consoleLog(`   Checking interfaces.d file: ${interfaceFile}`);
      
      try {
        const stats = await fs.stat(interfaceFile);
        // consoleLog(`   ✅ Interfaces.d file exists`);
        const parsedConfig = await this.parseInterfaceFile(interfaceFile);
        // consoleLog(`   Parsed config from interfaces.d: ${JSON.stringify(parsedConfig)}`);
        // Merge with defaults to ensure all fields are present
        Object.assign(defaultConfig, parsedConfig);
        // consoleLog(`   Final config after merge: ${JSON.stringify(defaultConfig)}`);
        return defaultConfig;
      } catch (error) {
        // consoleLog(`   ⚠️  Interfaces.d file not accessible: ${error.message}`);
      }
      
      // Check main interfaces file
      // consoleLog(`   Checking main interfaces file: ${this.interfacesFile}`);
      try {
        const stats = await fs.stat(this.interfacesFile);
        // consoleLog(`   ✅ Main interfaces file exists`);
        const parsedConfig = await this.parseInterfaceFile(this.interfacesFile, interfaceName);
        // consoleLog(`   Parsed config from main file: ${JSON.stringify(parsedConfig)}`);
        // Merge with defaults to ensure all fields are present
        Object.assign(defaultConfig, parsedConfig);
        // consoleLog(`   Final config after main file merge: ${JSON.stringify(defaultConfig)}`);
        return defaultConfig;
      } catch (error) {
        // consoleLog(`   ⚠️  Main interfaces file not accessible: ${error.message}`);
      }
      
      // Return default configuration if no files found
      // consoleLog(`   ⚠️  No configuration files found, using defaults`);
      return defaultConfig;
      
    } catch (error) {
      // const errorMsg = `Error getting persisted config for ${interfaceName}: ${error}`;
      // consoleLog(`   ❌ ${errorMsg}`, 'ERROR');
      return {
        method: 'dhcp',
        address: '',
        prefix: 24,
        gateway: '',
        dns: this.defaultDns.slice(),
        mtu: 1500
      };
    }
  }

  async parseInterfaceFile(filePath, targetInterface = null) {
    // consoleLog(`📖 Parsing interface file: ${filePath}`);
    if (targetInterface) {
      // consoleLog(`   Looking for specific interface: ${targetInterface}`);
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      // consoleLog(`   File read successfully, content length: ${content.length} characters`);
      
      if (targetInterface) {
        // Parse specific interface from main file
        // consoleLog(`   Parsing specific interface stanza for ${targetInterface}`);
        const result = this.parseInterfaceStanza(content, targetInterface);
        // consoleLog(`   Parsed result: ${JSON.stringify(result)}`);
        return result;
      } else {
        // Parse single interface file
        // consoleLog(`   Parsing single interface file`);
        const result = this.parseInterfaceStanza(content);
        // consoleLog(`   Parsed result: ${JSON.stringify(result)}`);
        return result;
      }
      
    } catch (error) {
      // consoleLog(`   ❌ Error parsing file ${filePath}: ${error}`, 'ERROR');
      return {};
    }
  }

  parseInterfaceStanza(content, targetInterface = null) {
    //consoleLog(`🔍 Parsing interface stanza from content`);
    // consoleLog(`   Content has ${content.split(/\s+/).length} words, ${content.split('\n').length} lines`);
    
    try {
      const lines = content.split('\n');
      let inInterface = false;
      let currentInterface = '';
      let stanzaLines = [];
      let stanzaCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) {
          continue;
        }
        
        if (line.startsWith('iface ') || line.startsWith('auto ') || line.startsWith('allow-hotplug ')) {
          if (inInterface) {
            // Process previous stanza
            stanzaCount++;
            // consoleLog(`   Processing stanza ${stanzaCount} for interface ${currentInterface}`);
            if (!targetInterface || currentInterface === targetInterface) {
              const result = this.parseStanzaContent(stanzaLines);
              // consoleLog(`   Stanza ${stanzaCount} result: ${JSON.stringify(result)}`);
              return result;
            }
          }
          
          // Start new stanza
          const parts = line.split(/\s+/);
          if (line.startsWith('iface ')) {
            currentInterface = parts[1];
            inInterface = true;
            stanzaLines = [line];
            // consoleLog(`   Starting new iface stanza for ${currentInterface}`);
          } else if (line.startsWith('auto ')) {
            if (parts[1] === targetInterface) {
              // consoleLog(`   Found auto line for ${targetInterface}`);
            }
          } else if (line.startsWith('allow-hotplug ')) {
            if (parts[1] === targetInterface) {
              // consoleLog(`   Found allow-hotplug line for ${targetInterface}`);
            }
          }
          
        } else if (inInterface && line) {
          stanzaLines.push(line);
          // consoleLog(`   Added stanza line: ${line}`);
        }
      }
      
      // Process last stanza
      if (inInterface && (!targetInterface || currentInterface === targetInterface)) {
        stanzaCount++;
        // consoleLog(`   Processing final stanza ${stanzaCount} for interface ${currentInterface}`);
        const result = this.parseStanzaContent(stanzaLines);
        // consoleLog(`   Final stanza result: ${JSON.stringify(result)}`);
        return result;
      }
      
      // consoleLog(`   No matching stanza found for target: ${targetInterface}`);
      return {};
      
    } catch (error) {
      const errorMsg = `Error parsing interface stanza: ${error}`;
      // consoleLog(`   ❌ ${errorMsg}`, 'ERROR');
      return {};
    }
  }

  parseStanzaContent(lines) {
    // consoleLog(`🔍 Parsing stanza content from ${lines.length} lines`);
    const config = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // consoleLog(`   Line ${i + 1}: '${line}'`);
      
      try {
        if (line.startsWith('iface ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            config.method = parts[3];
            config.family = parts[2] || 'inet';
            // consoleLog(`     Found method: ${parts[3]}`);
          } else {
            // consoleLog(`     ⚠️  iface line has insufficient parts: ${parts.join(', ')}`);
          }
        } else if (line.startsWith('address ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const address = parts[1];
            config.address = address;
            // consoleLog(`     Found address: ${address}`);
          }
        } else if (line.startsWith('netmask ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const netmask = parts[1];
            const prefix = this.netmaskToPrefix(netmask);
            config.prefix = prefix;
            // consoleLog(`     Found netmask: ${netmask} -> prefix: ${prefix}`);
          }
        } else if (line.startsWith('gateway ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) { 
            const gateway = parts[1];
            config.gateway = gateway;
            // consoleLog(`     Found gateway: ${gateway}`);
          }
        } else if (line.startsWith('dns-nameservers ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const dnsLine = parts.slice(1);
            config.dns = dnsLine;
            // consoleLog(`     Found DNS servers: ${dnsLine.join(', ')}`);
          }
        } else if (line.startsWith('mtu ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            try {
              const mtu = parseInt(parts[1]);
              config.mtu = mtu;
              // consoleLog(`     Found MTU: ${mtu}`);
            } catch (error) {
              // consoleLog(`     ⚠️  Invalid MTU value: ${parts[1]} - ${error.message}`);
            }
          }
        } else {
          // consoleLog(`     ⚠️  Unrecognized line format: ${line}`);
        }
      } catch (error) {
        // consoleLog(`     ⚠️  Error parsing line '${line}': ${error.message}`);
        continue;
      }
    }
    
    // consoleLog(`   Final parsed config: ${JSON.stringify(config)}`);
    return config;
  }

  netmaskToPrefix(netmask) {
    // consoleLog(`🔢 Converting netmask to prefix: ${netmask}`);
    
    try {
      const octets = netmask.split('.');
      // consoleLog(`   Octets: ${octets.join(', ')}`);
      
      if (octets.length !== 4) {
        // consoleLog(`   ⚠️  Invalid netmask format, expected 4 octets, got ${octets.length}`);
        return 24;
      }
      
      const binaryParts = [];
      for (let i = 0; i < octets.length; i++) {
        try {
          const octetInt = parseInt(octets[i]);
          if (octetInt < 0 || octetInt > 255) {
            // consoleLog(`   ⚠️  Invalid octet value: ${octetInt} at position ${i}`);
            return 24;
          }
          const binaryPart = octetInt.toString(2).padStart(8, '0');
          binaryParts.push(binaryPart);
          // consoleLog(`   Octet ${i}: ${octetInt} -> ${binaryPart}`);
        } catch (error) {
          // consoleLog(`   ⚠️  Invalid octet: ${octets[i]} at position ${i}`);
          return 24;
        }
      }
      
      const binary = binaryParts.join('');
      const prefix = (binary.match(/1/g) || []).length;
      // consoleLog(`   Binary: ${binary}`);
      // consoleLog(`   Prefix length: ${prefix}`);
      
      if (prefix < 0 || prefix > 32) {
        // consoleLog(`   ⚠️  Invalid prefix length: ${prefix}`);
        return 24;
      }
      
      return prefix;
      
    } catch (error) {
      //consoleLog(`   ❌ Error converting netmask ${netmask}: ${error.message}`);
      return 24; // Default to /24
    }
  }

  prefixToNetmask(prefix) {
    try {
      const p = Number(prefix);
      if (!Number.isInteger(p) || p < 0 || p > 32) {
        return '';
      }
      const mask = (0xffffffff << (32 - p)) >>> 0;
      return [
        (mask >>> 24) & 255,
        (mask >>> 16) & 255,
        (mask >>> 8) & 255,
        mask & 255
      ].join('.');
    } catch {
      return '';
    }
  }

  async getAllInterfaces() {
    try {
      // Get all interface names from the system
      const { stdout: linkStdout } = await execAsync(`ip -o link show | awk -F': ' '{print $2}'`);
      const allInterfaces = linkStdout
        .split('\n')
        .map(iface => iface.trim())
        .filter(iface => iface && iface !== 'lo'); // exclude loopback if desired
  
      const results = [];
  
      for (const interfaceName of allInterfaces) {
        try {
          const info = await this.getInterfaceInfo(interfaceName);
          const connectivity = await this.getConnectivityStatus(interfaceName);
          
          results.push({
            name: interfaceName,
            ip: info.ip || '',
            subnet: info.subnet || '',
            gateway: info.gateway || '',
            dns: info.dns || [],
            connectivity: connectivity
          });
        } catch {
          results.push({
            name: interfaceName,
            ip: '',
            subnet: '',
            gateway: '',
            dns: [],
            connectivity: {
              local: { connected: false, details: 'Error getting interface info' },
              internet: { reachable: false, details: 'Error getting interface info' }
            }
          });
        }
      }
  
      return { interfaces: results };
    } catch (error) {
      consoleLog(`❌ Failed to get interfaces: ${error}`, 'ERROR');
      return { interfaces: [] };
    }
  }

  async updateInterface(interfaceName, config) {
    // This is a placeholder - implement actual interface update logic
    // consoleLog(`🔄 Update interface called for ${interfaceName} with config: ${JSON.stringify(config)}`);
    return { success: true, message: `Interface ${interfaceName} updated successfully` };
  }
}

// Create global network manager instance
// consoleLog('🚀 Creating global NetworkManager instance...');
const networkManager = new NetworkManager();
// consoleLog('✅ Global NetworkManager instance created successfully');

module.exports = networkManager;
