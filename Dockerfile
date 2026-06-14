# Use a specific, stable Node.js Alpine version for a smaller image footprint
FROM node:22-alpine

# Set the environment variable for production
ENV NODE_ENV=production

# Create and set the active working directory inside the container
WORKDIR /usr/src/app

# Copy dependency files first to exploit Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly and clear the cache
RUN npm ci --only=production && npm cache clean --force

# Copy the remaining application source code
COPY . .

# Run the container as the unprivileged built-in 'node' user for security
USER node

# Document the port your app listens on (adjust if your app uses a different port)
EXPOSE 3001

# Start the application directly with Node
CMD ["node", "index.js"]
