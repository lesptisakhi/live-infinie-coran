#!/bin/bash

# Lancer le serveur HTTP en premier
node server.js &
sleep 3

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
OUTPUT="rtmp://a.rtmp.youtube.com/live2/rp4f-a4rp-adz9-hk5d-5fd4"

while true
do
    echo "" > ffmpeg.log

    ffmpeg -re \
        -loop 1 -i "$IMAGE" \
        -vf scale=854:480 \
        -f concat -safe 0 -i "$PLAYLIST" \
        -c:v libx264 -preset ultrafast -tune stillimage -b:v 2000k \
        -c:a aac -b:a 128k -ar 44100 \
        -pix_fmt yuv420p \
        -g 60 -keyint_min 60 \
        -shortest \
        -f flv "$OUTPUT" 2>&1 | tee -a ffmpeg.log

    echo "❌ Le flux s'est arrêté. Redémarrage dans 3 secondes..."
    sleep 3
done
