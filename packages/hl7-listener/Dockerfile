FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/hl7-listener/package.json ./packages/hl7-listener/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspace=rapid-cortex-hl7-listener --omit=dev 2>/dev/null || npm install --omit=dev

COPY packages/shared/dist ./packages/shared/dist
COPY packages/hl7-listener/dist ./packages/hl7-listener/dist

WORKDIR /app/packages/hl7-listener

EXPOSE 2575

ENV HL7_PORT=2575

CMD ["node", "dist/index.js"]
