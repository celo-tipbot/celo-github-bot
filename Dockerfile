FROM node:10.22-slim as builder
WORKDIR /celo-github-bot

RUN apt-get update -y
RUN apt-get install git lsb-release -y

WORKDIR /build
COPY package.json yarn.lock ./
RUN yarn install
COPY . ./
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]

