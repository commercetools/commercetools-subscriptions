FROM node:14-alpine3.15
MAINTAINER Professional Services <ps-dev@commercetools.com>

WORKDIR /app

COPY . /app

RUN npm ci --only=prod
CMD [ "node", "src/index.js" ]
