#!/bin/bash

# Green Project Backend Startup Script with Permission Handling
# This script helps resolve permission issues for device.yaml file

echo "🚀 Starting Green Project Backend with Permission Check..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "✅ Running as root - permissions should be fine"
else
    echo "⚠️  Not running as root - checking permissions..."
fi

# Set environment variables
export NODE_ENV=production
export EXPRESS_HOST=0.0.0.0
export EXPRESS_PORT=5001
export EXPRESS_DEBUG=false
export DEVICE_LIST_PATH=/srv/gfe-iot/devices/device.yaml
export BLUEPRINTS_DIR=/srv/gfe-iot/blueprints
export REFERENCE_CATALOG_PATH=/srv/gfe-iot/devices/valid_devices.json

# Check if device.yaml directory exists and has proper permissions
DEVICE_DIR="/srv/gfe-iot/devices"
DEVICE_FILE="/srv/gfe-iot/devices/device.yaml"

echo "📁 Checking device file permissions..."

# Create directory if it doesn't exist
if [ ! -d "$DEVICE_DIR" ]; then
    echo "📂 Creating device directory: $DEVICE_DIR"
    if [ "$EUID" -eq 0 ]; then
        mkdir -p "$DEVICE_DIR"
        chmod 755 "$DEVICE_DIR"
    else
        sudo mkdir -p "$DEVICE_DIR"
        sudo chmod 755 "$DEVICE_DIR"
    fi
fi

# Check if device.yaml exists, if not create it
if [ ! -f "$DEVICE_FILE" ]; then
    echo "📄 Creating default device.yaml file..."
    cat > /tmp/device.yaml << 'EOF'
devices_list: []
EOF
    
    if [ "$EUID" -eq 0 ]; then
        cp /tmp/device.yaml "$DEVICE_FILE"
        chmod 644 "$DEVICE_FILE"
    else
        sudo cp /tmp/device.yaml "$DEVICE_FILE"
        sudo chmod 644 "$DEVICE_FILE"
    fi
    rm /tmp/device.yaml
fi

# Set proper ownership and permissions
if [ "$EUID" -eq 0 ]; then
    echo "🔧 Setting file permissions as root..."
    chown -R $SUDO_USER:$SUDO_USER "$DEVICE_DIR" 2>/dev/null || true
    chmod 755 "$DEVICE_DIR"
    chmod 644 "$DEVICE_FILE"
else
    echo "🔧 Setting file permissions with sudo..."
    sudo chown -R $USER:$USER "$DEVICE_DIR" 2>/dev/null || true
    sudo chmod 755 "$DEVICE_DIR"
    sudo chmod 644 "$DEVICE_FILE"
fi

# Check if blueprints directory exists
if [ ! -d "/srv/gfe-iot/blueprints" ]; then
    echo "📂 Creating blueprints directory..."
    if [ "$EUID" -eq 0 ]; then
        mkdir -p /srv/gfe-iot/blueprints
        chmod 755 /srv/gfe-iot/blueprints
    else
        sudo mkdir -p /srv/gfe-iot/blueprints
        sudo chmod 755 /srv/gfe-iot/blueprints
    fi
fi

echo "✅ Permission check completed!"
echo "🌐 Starting backend server..."

# Start the Node.js application
if [ "$EUID" -eq 0 ]; then
    echo "🚀 Starting as root..."
    node src/app.js
else
    echo "🚀 Starting as user..."
    node src/app.js
fi

