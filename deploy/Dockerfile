FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm install --production

COPY server/ ./
COPY presets/ ./presets/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "index.js"]
