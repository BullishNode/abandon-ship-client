FROM node:22-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY proxy/package.json ./
RUN npm install

COPY proxy/ ./

EXPOSE 5174

CMD ["npm", "run", "dev"]
