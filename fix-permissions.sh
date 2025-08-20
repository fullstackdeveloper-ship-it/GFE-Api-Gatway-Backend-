#!/bin/bash

echo "🔧 Fixing permissions for Green Project Backend..."

# Create directories if they don't exist
sudo mkdir -p /srv/gfe-iot/devices
sudo mkdir -p /srv/gfe-iot/blueprints

# Create default device.yaml if it doesn't exist
if [ ! -f "/srv/gfe-iot/devices/device.yaml" ]; then
    echo "📄 Creating default device.yaml..."
    sudo tee /srv/gfe-iot/devices/device.yaml > /dev/null << 'EOF'
devices_list: []
EOF
fi

# Set proper ownership and permissions
echo "🔐 Setting file permissions..."
sudo chown -R $USER:$USER /srv/gfe-iot/
sudo chmod 755 /srv/gfe-iot/
sudo chmod 755 /srv/gfe-iot/devices/
sudo chmod 755 /srv/gfe-iot/blueprints/
sudo chmod 644 /srv/gfe-iot/devices/device.yaml

echo "✅ Permissions fixed!"
echo "🚀 You can now start the backend with:"
echo "   cd backend && node src/app.js"
echo ""
echo "   Or run as root with:"
echo "   sudo node src/app.js"

