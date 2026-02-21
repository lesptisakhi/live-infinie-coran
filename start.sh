#!/bin/bash

# Lancer le serveur HTTP en arrière-plan
# node server.js &
# sleep 2

# Dossier temporaire pour stocker les audios
AUDIO_DIR="/tmp/audio"
mkdir -p "$AUDIO_DIR"

# Télécharger les fichiers audio depuis GitHub Release
for i in $(seq -f "%03g" 1 114)
do
    URL="https://github.com/lesptisakhi/live-infinie-coran/releases/download/audio/$i.mp3"
    FILE="$AUDIO_DIR/$i.mp3"

    if [ ! -f "$FILE" ]; then
        echo "Téléchargement de $URL"
        curl -L "$URL" -o "$FILE"
    fi
done

# Générer playlist locale
PLAYLIST="/tmp/playlist.txt"
rm -f "$PLAYLIST"

for i in $(seq -f "%03g" 1 114)
do
    echo "file '$AUDIO_DIR/$i.mp3'" >> "$PLAYLIST"
done

IMAGE="img.png"
OUTPUT="rtmp://a.rtmp.youtube.com/live2/rp4f-a4rp-adz9-hk5d-5fd4"

while true
do
    echo "" > ffmpeg.log

    ffmpeg -re \
        -loop 1 -i "$IMAGE" \
        -f concat -safe 0 -i "$PLAYLIST" \
        -vf "scale=854:480,format=yuv420p" \
        -c:v libx264 -preset ultrafast -tune stillimage -b:v 2000k \
        -c:a aac -b:a 128k -ar 44100 \
        -g 60 -keyint_min 60 \
        -shortest \
        -f flv "$OUTPUT" 2>&1 | tee -a ffmpeg.log

    echo "❌ Le flux s'est arrêté. Redémarrage dans 3 secondes..."
    sleep 3
done
