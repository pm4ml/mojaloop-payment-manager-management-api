FROM node:lts-alpine as builder

RUN apk add --no-cache git python3 build-base

EXPOSE 3000

WORKDIR /src/

ARG NPM_TOKEN

# This is super-ugly, but it means we don't have to re-run npm install every time any of the source
# files change- only when any dependencies change- which is a superior developer experience when
# relying on docker-compose.
COPY ./src/.npmrc ./.npmrc
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
RUN rm -f ./.npmrc

FROM node:lts-alpine

# Install cfssl git make
RUN apk add --no-cache git make musl-dev go openssl

# golang env
ENV GOPATH /go
ENV GOROOT /usr/lib/go

ENV PATH /go/bin:$PATH:$GOROOT/bin:$GOPATH/bin/

# Install cfssl with Go and clean up
RUN rm -rf $GOPATH/src/github.com/cloudflare/cfssl

# WARNING: The next layer will be cached, it won't be re-fetched even if the tag changes on the github repo.
RUN git clone https://github.com/modusintegration/cfssl.git --branch=v1.3.4 $GOPATH/src/github.com/cloudflare/cfssl

WORKDIR $GOPATH/src/github.com/cloudflare/cfssl
# home made: build locally
RUN make
RUN ls -l bin
RUN cp bin/* /usr/bin
# clean up
RUN rm -rf ${GOROOT} ${GOPATH}

# Check cfssl version
RUN which cfssl
RUN cfssl version

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
