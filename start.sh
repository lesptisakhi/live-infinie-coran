#!/bin/bash

# Lancer le petit serveur Node.js en arrière-plan
node server.js &

IMAGE="image.png"
PLAYLIST="playlist.txt"
OUTPUT="rtmp://live.restream.io/live/re_11259084_event8dfc335bb78146ef8797a0fcacf25388"

while true
do
    echo "" > ffmpeg.log

    ffmpeg -re \
        -loop 1 -i "$IMAGE" \
        -f concat -safe 0 -i "$PLAYLIST" \
        -c:v libx264 -preset veryfast -tune stillimage -b:v 1500k \
        -c:a aac -b:a 128k -ar 44100 \
        -pix_fmt yuv420p \
        -g 60 -keyint_min 60 \
        -shortest \
        -f flv "$OUTPUT" 2>&1 | tee -a ffmpeg.log

    echo "❌ Le flux s'est arrêté. Redémarrage dans 3 secondes..."
    sleep 3
done
