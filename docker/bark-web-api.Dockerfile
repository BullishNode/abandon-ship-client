FROM node:22-alpine AS builder
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm ci
COPY api ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/api/dist ./dist
USER node
EXPOSE 4001
CMD ["node", "dist/index.js"]
