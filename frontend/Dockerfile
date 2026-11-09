# Stage 1: Build React + TypeScript + Vite SPA
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ARG VITE_CESIUM_ION_TOKEN=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_CESIUM_ION_TOKEN=${VITE_CESIUM_ION_TOKEN}

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Hardened Non-Root Nginx 1.27 Runtime on Port 8080
FROM nginx:1.27-alpine AS runtime

RUN adduser -D -u 10001 appuser && \
    mkdir -p /var/cache/nginx /var/run /tmp && \
    chown -R appuser:appuser /var/cache/nginx /var/run /tmp /usr/share/nginx/html /etc/nginx/conf.d

COPY --chown=appuser:appuser nginx.conf /etc/nginx/nginx.conf
COPY --from=builder --chown=appuser:appuser /app/dist /usr/share/nginx/html

USER 10001

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
