FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api --omit=dev 2>/dev/null || npm install --omit=dev --workspace=apps/api

COPY packages/shared/dist ./packages/shared/dist
COPY apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 8080
ENV PORT=8080
ENV NOVA_SONIC_BEDROCK_MOCK=false

CMD ["node", "dist/call-assist/nova-sonic/gateway/server.js"]
