FROM node:14-alpine3.15
MAINTAINER Professional Services <ps-dev@commercetools.com>

WORKDIR /app

COPY . /app

run apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers make python && \
  npm install --quiet node-gyp -g &&\
  npm install --quiet && \
  apk del native-deps

RUN npm ci --only=prod
CMD [ "node", "src/index.js" ]
