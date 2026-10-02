# TODO use node:lts after this has been fixed https://github.com/nodejs/docker-node/issues/1946
FROM node:22.7.0 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./

ARG VITE_SSD_ROOT_URL
ARG VITE_AUTH_AUTH0_DOMAIN
ARG VITE_AUTH_AUTH0_CLIENTID
ARG VITE_NOAUTH
ARG VITE_NOAUTH_USER_NAME
ARG VITE_NOAUTH_USER_EMAIL
ARG VITE_AUTH_REDIRECT_URI
ARG VITE_RMQ_TOPIC_GEOPOSE_UPDATE
ARG VITE_RMQ_TOPIC_OBJECT_CREATED
ARG VITE_RMQ_TOPIC_SENSOR_UPDATE
ARG VITE_RMQ_TOPIC_RETICLE_UPDATE
ARG VITE_POI_SEARCH_BASEURL

ENV VITE_SSD_ROOT_URL=${VITE_SSD_ROOT_URL}
ENV VITE_AUTH_AUTH0_DOMAIN=${VITE_AUTH_AUTH0_DOMAIN}
ENV VITE_AUTH_AUTH0_CLIENTID=${VITE_AUTH_AUTH0_CLIENTID}
ENV VITE_NOAUTH=${VITE_NOAUTH}
ENV VITE_NOAUTH_USER_NAME=${VITE_NOAUTH_USER_NAME}
ENV VITE_NOAUTH_USER_EMAIL=${VITE_NOAUTH_USER_EMAIL}
ENV VITE_AUTH_REDIRECT_URI=${VITE_AUTH_REDIRECT_URI}
ENV VITE_RMQ_TOPIC_GEOPOSE_UPDATE=${VITE_RMQ_TOPIC_GEOPOSE_UPDATE}
ENV VITE_RMQ_TOPIC_OBJECT_CREATED=${VITE_RMQ_TOPIC_OBJECT_CREATED}
ENV VITE_RMQ_TOPIC_SENSOR_UPDATE=${VITE_RMQ_TOPIC_SENSOR_UPDATE}
ENV VITE_RMQ_TOPIC_RETICLE_UPDATE=${VITE_RMQ_TOPIC_RETICLE_UPDATE}
ENV VITE_POI_SEARCH_BASEURL=${VITE_POI_SEARCH_BASEURL}

RUN npm run build

# Shared static files. `ENV a=` lets nginx templates escape `$uri` as `$${a}uri`.
FROM nginx:stable-alpine AS nginx-base
COPY --from=build /app/dist /usr/share/nginx/html
ENV a=

# HTTPS dev image. Cert is generated here so a private key is not stored in the repo or the HTTP image.
FROM nginx-base AS deploy-https
COPY nginx.dev.conf /etc/nginx/templates/default.conf.template
RUN apk add --no-cache --virtual .cert-build openssl \
    && mkdir -p /etc/nginx/ssl \
    && openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    && apk del .cert-build
EXPOSE 443

# Default image: HTTP on port 80. `docker build` without `--target` lands here.
FROM nginx-base AS deploy
COPY nginx.prod.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
