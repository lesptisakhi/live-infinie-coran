#!/bin/bash

# Lancer le serveur web en arrière-plan
node server.js &

# Lien direct vers ta vidéo GitHub Release
INPUT="https://piped.video/redirect?video=Vi-B-Zu7LZ4"

# URL YouTube / Restream / Twitch
YOUTUBE_URL="$YOUTUBE_URL"

# Boucle infinie pour relancer le live
while true
do
    echo "🚀 Lancement du live YouTube..."

    # On vide le fichier log à chaque redémarrage
    echo "" > ffmpeg.log

    # FFmpeg + pipe vers ffmpeg.log
    ffmpeg -re -i "$INPUT" \
        -c:v libx264 -preset veryfast -b:v 4500k \
        -c:a aac -b:a 128k -ar 44100 \
        -f flv "$YOUTUBE_URL" 2>&1 | tee -a ffmpeg.log

    echo "❌ Le live s'est arrêté. Redémarrage dans 5 secondes..."
    sleep 5
done
