FROM node:22

WORKDIR /home/node/app

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

CMD [ "npm", "run", "start:dev" ]
