#!/bin/bash

# Installer FFmpeg (nécessaire sur Render en mode Node.js)
apt-get update && apt-get install -y ffmpeg

# Variables
INPUT="video.mp4"
YOUTUBE_URL="$YOUTUBE_URL"

# Boucle infinie pour relancer le live automatiquement
while true
do
    echo "🚀 Lancement du live YouTube..."
    
    ffmpeg -re -stream_loop -1 -i "$INPUT" \
        -c:v libx264 -preset veryfast -b:v 4500k \
        -c:a aac -b:a 128k -ar 44100 \
        -f flv "$YOUTUBE_URL"

    echo "❌ Le live s'est arrêté. Redémarrage dans 5 secondes..."
    sleep 5
done
