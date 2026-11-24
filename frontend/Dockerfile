# ========================================================
# Stage 1: Build the React + Vite static bundle
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (utilize layer caching)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy frontend source code
COPY . .

# Build production assets into /app/dist
RUN npm run build

# ========================================================
# Stage 2: Serve production assets via high-performance Nginx
# ========================================================
FROM nginx:alpine AS runner

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
