FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:bark-web"]