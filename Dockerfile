FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOST=0.0.0.0
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/client/dist ./client/dist
COPY shared ./shared
COPY server/src ./server/src
RUN mkdir -p server/data && chown node:node server/data
USER node
EXPOSE 3001
CMD ["node", "server/src/index.js"]
