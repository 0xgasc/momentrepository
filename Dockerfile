# Use Node.js with build tools for canvas package
# Node 20+ required for cheerio, undici, @tus packages
FROM node:20-bullseye

# Force cache invalidation
ARG CACHE_BUST=4
RUN echo "Cache bust: ${CACHE_BUST}"

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

# Copy backend package files ONLY (not node_modules)
COPY setlist-proxy/package*.json ./

# Clean install dependencies
RUN npm cache clean --force && npm install --omit=dev

# Copy backend source code (excluding node_modules via .dockerignore)
COPY setlist-proxy/ .

# Set environment variables
ENV MONGO_URI="mongodb+srv://umo-backend:XwQTAhFpsEo5Hqvs@cluster0.ezddywd.mongodb.net/umo-archive?retryWrites=true&w=majority&appName=Cluster0"
ENV NODE_ENV=production

# Expose port
EXPOSE 5050

# Start the server with node directly for clearer error output
CMD ["node", "server.js"]