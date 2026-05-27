# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Runtime stage
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist/ ./dist/

# Non-root user
RUN addgroup --system covenantd && adduser --system --ingroup covenantd covenantd
USER covenantd

# Environment defaults
ENV NODE_ENV=production
ENV RPC_URL=https://sepolia.base.org
ENV CHAIN_ID=84532

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

# Default: run event listener
CMD ["node", "dist/event-listener.js"]
