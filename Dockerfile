# PulseSave — container image (full functionality: real yt-dlp downloads)
#
# Vercel's serverless runtime cannot run yt-dlp. Deploy this image instead on
# Render, Railway, Fly.io, Kubernetes or any VPS to enable live downloads.
#
#   docker build -t pulsesave .
#   docker run -p 3000:3000 pulsesave

FROM node:22-slim

# ffmpeg unlocks merged high-quality renditions (YouTube 1440p/4K).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp official standalone binary (no Python runtime needed).
ADD https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
# `npm install` uses the lockfile when it is present (reproducible builds) and
# regenerates it from package.json when it is not.
RUN npm install --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public
COPY api ./api

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
