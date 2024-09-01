## *Builder*
FROM node:16.15.0-alpine AS builder

RUN apk add --no-cache git python3 build-base

## Create app directory
WORKDIR /opt/app

## Copy basic files for installing dependencies
COPY tsconfig.json package*.json /opt/app/
RUN npm ci
COPY src /opt/app/src

## Build the app
RUN npm run build

## *Application*
FROM node:16.15.0-alpine

RUN apk add --no-cache git python3 g++ make
WORKDIR /opt/app

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

COPY tsconfig.json package*.json /opt/app/

RUN npm ci --production

## Copy of dist directory from builder
COPY --from=builder /opt/app/dist ./dist

## Expose any application ports
EXPOSE 3000

CMD [ "npm" , "start" ]
