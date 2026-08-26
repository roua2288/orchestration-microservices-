FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY app.js ./

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget --quiet --spider http://127.0.0.1/health || exit 1

CMD ["npm", "start"]