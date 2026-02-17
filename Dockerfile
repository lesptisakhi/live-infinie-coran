FROM node:18

# Installer FFmpeg et curl
RUN apt update && apt install -y ffmpeg curl

# Copier les fichiers
COPY start.sh /start.sh
COPY server.js /server.js

RUN chmod +x /start.sh

# Installer express proprement
RUN npm install express

# Lancer FFmpeg + le serveur web
CMD bash -c "/start.sh & node /server.js"
