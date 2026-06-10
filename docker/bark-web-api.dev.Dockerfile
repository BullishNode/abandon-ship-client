FROM docker.io/node:22-alpine
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm ci
COPY api ./
EXPOSE 4001
CMD ["npm", "run", "dev"]
