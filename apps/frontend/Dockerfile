FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY ../../package*.json ./
COPY ../../package-lock.json ./

# Copy frontend package files
COPY ./package*.json ./apps/frontend/

# Install dependencies
RUN npm ci

# Copy frontend source
COPY . ./apps/frontend/

# Set working directory to frontend
WORKDIR /app/apps/frontend

# Build the application
RUN npm run build

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host"]
