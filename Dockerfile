# Use Node.js with build tools for canvas package
FROM node:18-bullseye

# Install system dependencies for canvas and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend package files
COPY setlist-proxy/package*.json ./

# Install dependencies with verbose logging
RUN npm install --only=production --verbose

# Copy backend source code
COPY setlist-proxy/ .

# Expose port
EXPOSE 5050

# Start the server
CMD ["npm", "start"]