# Stage 1 : préparation des fichiers
FROM alpine:3.22 AS builder

WORKDIR /build

COPY index.html .

RUN mkdir -p /dist && \
    cp index.html /dist/index.html

# Stage 2 : image runtime minimale
FROM nginx:1.29-alpine AS runtime

COPY --from=builder /dist/index.html /usr/share/nginx/html/index.html

EXPOSE 80

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=5s \
  --retries=3 \
  CMD ["wget", "--quiet", "--spider", "http://127.0.0.1/"]

CMD ["nginx", "-g", "daemon off;"]