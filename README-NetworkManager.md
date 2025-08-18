# NetworkManager for Debian 11 with ifupdown

## Overview

The `NetworkManager` class provides comprehensive network interface management for Debian 11 systems using the `ifupdown` networking system. It automatically discovers network interfaces, retrieves both runtime and persistent configuration information, and provides detailed status reporting.

## Features

### 🔍 **Automatic Interface Discovery**
- Automatically detects all available network interfaces on the system
- Filters out virtual, loopback, and wireless interfaces
- Falls back to common interface names if discovery fails

### 📊 **Comprehensive Information Retrieval**
- **Runtime Information**: Current interface state, IP addresses, routes, MTU, MAC address
- **Persistent Configuration**: ifupdown configuration files parsing
- **System Information**: Interface speed, carrier status, driver information
- **Statistics**: Interface packet and byte counters
- **Validation**: IP address format validation and configuration consistency checks

### 🛡️ **Robust Error Handling**
- Retry mechanisms for network commands
- Graceful fallbacks when information retrieval fails
- Comprehensive error reporting and logging
- Timeout protection for network operations

### 📁 **ifupdown Configuration Parsing**
- Parses `/etc/network/interfaces` main file
- Parses `/etc/network/interfaces.d/` directory files
- Supports all standard ifupdown directives:
  - `iface`, `auto`, `allow-hotplug`
  - `address`, `netmask`, `gateway`
  - `dns-nameservers`, `mtu`, `hwaddress`
  - `post-up`, `pre-down` commands

## Installation and Setup

### Prerequisites
- Debian 11 (Bullseye) or compatible system
- Python 3.7+
- `ip` command available (iproute2 package)
- `ifupdown` package installed
- Root/sudo access for some operations

### Dependencies
```bash
# Install required system packages
sudo apt update
sudo apt install iproute2 ifupdown

# Python dependencies (already included in requirements.txt)
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from services.network.network_manager import network_manager

# Get information for all interfaces
all_interfaces = network_manager.get_all_interfaces()
print(f"Found {all_interfaces['total_count']} interfaces")

# Get detailed information for a specific interface
interface_info = network_manager.get_interface_info("eth0")
print(f"Interface {interface_info['name']} is {interface_info['admin_state']}")

# Refresh interface discovery
refresh_result = network_manager.refresh_interfaces()
```

### Interface Information Structure

```python
interface_info = {
    "name": "eth0",                    # Interface name
    "admin_state": "up",               # Administrative state (up/down/unknown)
    "oper_state": "up",                # Operational state (up/down/unknown)
    "mac": "00:15:5d:01:ca:05",       # MAC address
    "mtu": 1500,                       # MTU size
    "ipv4": [                          # IPv4 addresses
        {
            "address": "192.168.1.100",
            "prefix": 24,
            "broadcast": "192.168.1.255",
            "scope": "global"
        }
    ],
    "routes": [                        # Routing information
        {
            "dst": "default",
            "via": "192.168.1.1",
            "metric": 0,
            "scope": "global"
        }
    ],
    "persist": {                       # Persistent configuration
        "method": "static",
        "address": "192.168.1.100",
        "prefix": 24,
        "gateway": "192.168.1.1",
        "dns": ["8.8.8.8", "1.1.1.1"],
        "mtu": 1500,
        "auto": True,
        "allow_hotplug": False
    },
    "system": {                        # System information
        "speed": {"speed": 1000, "unit": "Mbps"},
        "carrier": "up",
        "driver": "e1000"
    },
    "stats": {                         # Interface statistics
        "rx_packets": 12345,
        "tx_packets": 67890,
        "rx_bytes": 1234567,
        "tx_bytes": 8901234
    },
    "last_updated": 1640995200.0,     # Timestamp
    "warnings": []                     # Configuration warnings
}
```

### Configuration File Examples

#### Static IP Configuration
```bash
# /etc/network/interfaces.d/eth0
auto eth0
iface eth0 inet static
    address 192.168.1.100
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 1.1.1.1
    mtu 1500
```

#### DHCP Configuration
```bash
# /etc/network/interfaces.d/eth1
auto eth1
iface eth1 inet dhcp
    mtu 1500
```

#### Hotplug Interface
```bash
# /etc/network/interfaces.d/eth2
allow-hotplug eth2
iface eth2 inet dhcp
```

## Testing

### Run the Test Suite
```bash
cd backend
python test-network-manager.py
```

### Run the Demo
```bash
cd backend
python demo-network-manager.py
```

### Test Individual Components
```python
# Test interface discovery
nm = NetworkManager()
print(f"Discovered interfaces: {nm.managed_interfaces}")

# Test specific interface
info = nm.get_interface_info("eth0")
print(json.dumps(info, indent=2))

# Test error handling
try:
    nm.get_interface_info("nonexistent")
except ValueError as e:
    print(f"Correctly handled error: {e}")
```

## Error Handling and Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Ensure proper permissions for network operations
   sudo chmod +s /bin/ip
   # Or run the application with appropriate privileges
   ```

2. **Interface Not Found**
   ```python
   # Check if interface exists
   if nm._interface_exists("eth0"):
       print("Interface exists")
   else:
       print("Interface not found")
   ```

3. **Configuration Parsing Errors**
   ```python
   # Check ifupdown files exist
   import os
   print(f"Main file: {os.path.exists('/etc/network/interfaces')}")
   print(f"Config dir: {os.path.exists('/etc/network/interfaces.d')}")
   ```

### Debugging

Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check system commands:
```bash
# Verify ip command works
ip -j link show

# Check ifupdown status
systemctl status networking

# View interface configuration
cat /etc/network/interfaces
ls -la /etc/network/interfaces.d/
```

## Performance Considerations

- **Interface Discovery**: Runs once during initialization, cached until refresh
- **Information Retrieval**: Uses efficient `ip` command with JSON output
- **Configuration Parsing**: File-based parsing with caching
- **Timeout Protection**: 10-second timeout for network operations
- **Retry Mechanism**: Up to 3 retries for failed operations

## Security Notes

- The NetworkManager requires access to system network information
- Some operations may require elevated privileges
- Configuration files are read-only by default
- No network configuration changes are made by default (read-only mode)

## API Reference

### Core Methods

- `get_interface_info(interface_name)` - Get detailed interface information
- `get_all_interfaces()` - Get information for all managed interfaces
- `refresh_interfaces()` - Rediscover and refresh interface information

### Internal Methods

- `_discover_managed_interfaces()` - Discover available interfaces
- `_get_runtime_info(interface_name)` - Get runtime interface state
- `_get_persisted_config(interface_name)` - Parse ifupdown configuration
- `_parse_interface_file(file_path)` - Parse configuration files
- `_validate_interface_info(interface_info)` - Validate configuration

## Contributing

When contributing to the NetworkManager:

1. Test on Debian 11 systems
2. Ensure compatibility with ifupdown
3. Add comprehensive error handling
4. Include timeout protection for network operations
5. Add logging for debugging
6. Update tests and documentation

## License

This NetworkManager is part of the Green Project and follows the project's licensing terms.
