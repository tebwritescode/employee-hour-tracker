# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Copy Chart.js to public directory for local serving
RUN cp node_modules/chart.js/dist/chart.umd.js ./public/chart.js

# Create directories for SQLite database and backups with proper permissions
RUN mkdir -p /app/data /app/backups && \
    chown -R node:node /app/data /app/backups && \
    chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose port 3000
EXPOSE 3000

# Create volumes for persistent database and backup storage
VOLUME ["/app/data", "/app/backups"]

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/employee_tracker.db
ENV SESSION_SECRET=your-secure-session-secret-change-me
ENV DEFAULT_ADMIN_USERNAME=admin
ENV DEFAULT_ADMIN_PASSWORD=admin123
ENV BACKUP_DIR=/app/backups
ENV BACKUP_INTERVAL_HOURS=24
ENV MAX_BACKUPS=7

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 3000, path: '/', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200) process.exit(0); \
        else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the application
CMD ["npm", "start"]