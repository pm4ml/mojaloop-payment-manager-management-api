FROM node:lts-alpine as builder

RUN apk add --no-cache git python3 build-base

EXPOSE 3000

WORKDIR /src/

ARG NPM_TOKEN

# This is super-ugly, but it means we don't have to re-run npm install every time any of the source
# files change- only when any dependencies change- which is a superior developer experience when
# relying on docker-compose.
COPY ./src/package.json ./package.json
# COPY ./src/package-lock.json ./package-lock.json
COPY ./src/lib/database/package.json ./lib/database/package.json
COPY ./src/lib/vault/package.json ./lib/vault/package.json
COPY ./src/lib/model/package.json ./lib/model/package.json
COPY ./src/lib/randomphrase/package.json ./lib/randomphrase/package.json
COPY ./src/lib/requests/package.json ./lib/requests/package.json
# for local testing
# COPY ./src/lib/mcmclient/package.json ./lib/mcmclient/package.json
# COPY ./src/lib/mcmclient/lib/pkiengine/package.json ./lib/mcmclient/lib/pkiengine/package.json


RUN npm install --only=production

FROM node:lts-alpine

# APP
WORKDIR /

ARG BUILD_DATE
ARG VCS_URL
ARG VCS_REF
ARG VERSION

# See http://label-schema.org/rc1/ for label schema info
LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.name="mojaloop-payment-manager-management-api-service"
LABEL org.label-schema.build-date=$BUILD_DATE
LABEL org.label-schema.vcs-url=$VCS_URL
LABEL org.label-schema.vcs-ref=$VCS_REF
LABEL org.label-schema.version=$VERSION

COPY --from=builder /src/ /src
COPY ./src ./src

CMD ["node", "src/index.js"]
