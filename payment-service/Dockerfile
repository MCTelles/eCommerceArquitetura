FROM node:18-alpine AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/prisma ./prisma

CMD sh -lc "npx prisma migrate deploy && node dist/index.js"
