FROM node:14-alpine3.15
MAINTAINER Professional Services <ps-dev@commercetools.com>

WORKDIR /app

COPY . /app

RUN apk add --no-cache --virtual .gyp python3 make g++
RUN npm install --quiet node-gyp -g

RUN npm ci --only=prod
CMD [ "node", "src/index.js" ]
