# NFTicket Buyer App - Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/app/.next ./apps/app/.next
COPY --from=builder /app/apps/app/public ./apps/app/public

EXPOSE 3002
ENV PORT=3002
ENV NODE_ENV=production

CMD ["npm", "start"]
