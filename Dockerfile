FROM node:lts
WORKDIR /usr/src/app
COPY package.json ./
COPY node_modules ./node_modules
COPY src ./src
ENV CONFIG_PATH=/usr/src/app/config/config.yaml
EXPOSE 3000
VOLUME /usr/src/app/config
CMD ["yarn", "start"]
