FROM node:22

# Create app directory
WORKDIR /home/node/app

# Install ffmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Copy dependency files and install
COPY package*.json ./
# Important
RUN npm install github:zoom/rtms

# Copy rest of the source code
COPY . .

CMD ["npm", "run", "start"]
