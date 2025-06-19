FROM node:20-slim

RUN apt-get update && apt-get install -y postgresql-client && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

CMD ["node", "dist/backup.js"]
