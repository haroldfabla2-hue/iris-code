FROM node:18-alpine

WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY team.js ./
EXPOSE 8000
CMD ["node", "team.js"]