FROM node:lts-alpine as builder

RUN apk add --no-cache git python3 build-base

EXPOSE 3000

WORKDIR /app/

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm install --only=production

FROM node:lts-alpine

# APP
WORKDIR /app

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

COPY --from=builder /app/ /app
COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json

CMD ["npm", "start"]
