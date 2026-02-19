#!/bin/bash

node server.js &

# Dossier temporaire pour stocker les audios
AUDIO_DIR="/tmp/audio"
mkdir -p "$AUDIO_DIR"

# Télécharger les 114 fichiers audio depuis la Release
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

IMAGE="image.png"
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
