FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json* ./api/
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
