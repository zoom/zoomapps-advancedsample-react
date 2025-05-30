# Zoom App Setup for RTMS server

### Starting Docker Containers with Docker Compose:

###### Start and rebuild default containers (`frontend`, `backend`, and `redis`):

```bash
docker compose up --build
```

###### Start and rebuild only RTMS with websocket mode:

```bash
docker-compose up --build rtms-websocket
```

###### Start and rebuild only RTMS with @zoom/rtms mode:

```bash
docker-compose up --build rtms-sdk
```

###### Start and rebuild all containers and RTMS with websocket mode:

```bash
docker compose --profile websocket up --build
```

###### Start and rebuild all containers and RTMS with the @zoom/rtms mode

```bash
docker compose --profile sdk up --build
```

---

## Setup for RTMS-Sdk (@zoom/rtms)

### Listens on local PORT 3003

In this project, the rtms-sdk container will listen for https requests on your local port 3003. Please make sure you have a public domain using https to serve traffic to port 3003 on your local machine (eg tool such as frp or ngrok)

### Creates an http handler at the /rtms path

IMPORTANT: Use the following url to configure your Zoom App.

your-public-domain/rtms

### Set up the Zoom App in Zoom Marketplace

#### Create the webhook for rtms start event

In the build flow, under Features -> Access -> General Features:

1. Choose "Webhook" method
2. Give the event a name
3. Add Event notification endpoint URL: See above url
4. Click save

#### Add API scopes

Under Features -> Surface -> Add APIs: Select startRTMS and stopRTMS

#### Add User scopes

Under Scopes -> Add Scopes search for "rtms" and click to add the relevant scopes:

- Get all real-time audio streams of a user's meetings
- Get all real-time meeting chats in a user's meetings
- Get all real-time screen shares in a user's meetings
- Get all real-time audio transcripts of a user's meetings
- Get all real-time video streams of a user's meetings

### Usage

Copy the .env.example to .env and fill it out

```bash
cp .env.example .env
```

---

## Setup for RTMS-Websocket

### Listens on local PORT 3002

In this project, the rtms-websocket container will listen for https requests on your local port 3002. Please make sure you have a public domain using https to serve traffic to port 3002 on your local machine (eg tool such as frp or ngrok)

### Creates an http handler at the /rtms path

IMPORTANT: Use the following url to configure your Zoom App.

your-public-domain/rtms

### Set up the Zoom App in Zoom Marketplace

#### Create the webhook for rtms start event

Please see steps in rtms-sdk above

#### Add API scopes

Please see steps in rtms-sdk above

#### Add User scopes

Please see steps in rtms-sdk above

### Usage

Please see steps in rtms-sdk above
