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

# Set environment variables (temporary fix)
ENV MONGO_URI="mongodb+srv://umo-backend:XwQTAhFpsEo5Hqvs@cluster0.ezddywd.mongodb.net/umo-archive?retryWrites=true&w=majority&appName=Cluster0"

# Expose port
EXPOSE $PORT

# Start the server
CMD ["npm", "start"]