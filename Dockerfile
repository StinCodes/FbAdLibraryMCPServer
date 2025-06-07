# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.17.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules and Playwright dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential node-gyp pkg-config python-is-python3 \
    # Playwright dependencies
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxcb1 libxkbcommon0 \
    libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 libgbm1 libxss1 libasound2 \
    # Additional deps for Playwright
    libpango-1.0-0 libcairo2

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Install Playwright browsers explicitly
RUN npx playwright install chromium

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Install runtime dependencies for Playwright
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxcb1 libxkbcommon0 \
    libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 libgbm1 libxss1 libasound2 \
    # Additional deps for Playwright
    libpango-1.0-0 libcairo2 && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Copy Playwright browser cache
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
