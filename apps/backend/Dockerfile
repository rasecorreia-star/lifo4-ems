FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY ../../package*.json ./
COPY ../../package-lock.json ./

# Copy backend package files
COPY ./package*.json ./apps/backend/

# Install dependencies
RUN npm ci

# Copy backend source
COPY . ./apps/backend/

# Set working directory to backend
WORKDIR /app/apps/backend

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
