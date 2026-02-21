FROM node:18

# Installer FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Créer le dossier app
WORKDIR /app

# Copier les fichiers
COPY package*.json ./
RUN npm install

COPY . .

# Exposer le port Fly.io
ENV PORT=8080
EXPOSE 8080

# Lancer ton serveur
CMD ["node", "server.js"]
