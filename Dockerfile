# Base image: Debian 11 (bullseye)
FROM debian:11

ENV DEBIAN_FRONTEND=noninteractive

# Update and install required system packages
RUN apt-get update && apt-get install -y \
    curl ca-certificates gnupg \
    sudo systemd udev \
    ifupdown net-tools iproute2 iputils-ping \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x and npm via NodeSource for Debian 11
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy only package files (better for caching layers)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev || npm install

# Copy entire backend source code
COPY . .

# Optional: Copy IoT YAML configs into the container if path exists in project
# Uncomment or adjust this if you actually have it
COPY ./gfe-iot /data/gfe-iot/

# Ensure start.sh is executable
RUN chmod +x /app/start.sh || true

# Expose ports
EXPOSE 3000
EXPOSE 5001

# Set environment variables
ENV EXPRESS_HOST=0.0.0.0 \
    EXPRESS_PORT=5001 \
    EXPRESS_DEBUG=true \
    DEVICE_LIST_PATH=/data/gfe-iot/devices/device.yaml \
    BLUEPRINTS_DIR=/data/gfe-iot/blueprints

# Start the backend
CMD ["/bin/bash", "/app/start.sh"]
