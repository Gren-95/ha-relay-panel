FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# install production deps first (better layer caching), reproducibly from the lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# app source
COPY . .

# run unprivileged (the web tier is stateless; all state lives in MariaDB)
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
