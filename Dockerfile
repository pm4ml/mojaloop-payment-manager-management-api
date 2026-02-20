ARG NODE_VERSION=22.19.0-alpine

FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache git python3 build-base
WORKDIR /opt/app

COPY tsconfig.json package*.json ./
RUN npm ci

COPY src ./src
RUN npm run build
RUN npm prune --production

## Production
FROM node:${NODE_VERSION}

WORKDIR /opt/app

ARG BUILD_DATE
ARG VCS_URL
ARG VCS_REF
ARG VERSION

LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.name="mojaloop-payment-manager-management-api-service"
LABEL org.label-schema.build-date=$BUILD_DATE
LABEL org.label-schema.vcs-url=$VCS_URL
LABEL org.label-schema.vcs-ref=$VCS_REF
LABEL org.label-schema.version=$VERSION

COPY --from=builder /opt/app/node_modules ./node_modules
COPY --from=builder /opt/app/dist ./dist
COPY package.json ./

CMD ["node", "dist/index.js"]
