#!/bin/bash

# Installer FFmpeg
apt-get update && apt-get install -y ffmpeg

# Lancer le serveur web en arrière-plan
node server.js &

# Lien direct vers ta vidéo GitHub Release
INPUT="https://github.com/lesptisakhi/live-infinie-coran/releases/download/video/video.mp4"

# URL YouTube RTMP
YOUTUBE_URL="rtmp://live.restream.io/live/re_11259084_event33c6f39ecb274ef88d19aa61e1558c09"

# Boucle infinie pour relancer le live
while true
do
    echo "🚀 Lancement du live YouTube..."

    ffmpeg -re -i "$INPUT" \
        -c:v libx264 -preset veryfast -b:v 4500k \
        -c:a aac -b:a 128k -ar 44100 \
        -f flv "$YOUTUBE_URL"

    echo "❌ Le live s'est arrêté. Redémarrage dans 5 secondes..."
    sleep 5
done
