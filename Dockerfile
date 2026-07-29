# =========================================================================
# CyberAudit - Image Docker
# Node 20 Alpine, volume de donnees persistant /data, port 4000.
# =========================================================================
FROM node:20-alpine

# Repertoire de travail de l'application.
WORKDIR /app

ENV NODE_ENV=production

# Installe uniquement les dependances de production (PDFKit).
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copie le code de l'application.
COPY . .

# Configuration par defaut (surchargeable a l'execution).
ENV PORT=4000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

# Volume persistant pour les cles d'acces (paywall).
VOLUME ["/data"]

EXPOSE 4000

# Verification de sante (busybox wget dispo dans alpine).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/healthz >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
