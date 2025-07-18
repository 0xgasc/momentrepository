# Use Node.js 18 or higher
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy backend package files
COPY setlist-proxy/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY setlist-proxy/ .

# Expose port
EXPOSE 5050

# Start the server
CMD ["npm", "start"]