# ---- CSS build stage: install all deps (incl. Tailwind) and compile the stylesheet ----
FROM node:24-alpine AS cssbuild
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tailwind.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build:css

# ---- Runtime stage ----
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# Bake version info into the image (#78)
ARG GIT_SHA
ARG BUILD_DATE
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

# install production deps first (better layer caching), reproducibly from the lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# app source
COPY . .
# overwrite the committed stylesheet with the freshly compiled one
COPY --from=cssbuild /app/public/style.css ./public/style.css

# run unprivileged (the web tier is stateless; all state lives in MariaDB)
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
