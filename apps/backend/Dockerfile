FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist/ ./dist/
COPY docs/ ./docs/

# Create cache and logs directories
RUN mkdir -p /app/cache /app/logs

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S proxy -u 1001

# Change ownership of app directory
RUN chown -R proxy:nodejs /app

# Switch to non-root user
USER proxy

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"] 