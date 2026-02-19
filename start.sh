#!/bin/bash

node server.js &

INPUT_IMAGE="image.jpg"
INPUT_AUDIO="audio.mp3"
OUTPUT="rtmp://live.restream.io/live/re_11259084_event8dfc335bb78146ef8797a0fcacf25388"

while true
do
    echo "" > ffmpeg.log

    ffmpeg -loop 1 -i "$INPUT_IMAGE" \
           -stream_loop -1 -i "$INPUT_AUDIO" \
           -c:v libx264 -preset veryfast -tune stillimage -b:v 1500k \
           -c:a aac -b:a 128k -ar 44100 \
           -pix_fmt yuv420p \
           -g 60 -keyint_min 60 \
           -f flv "$OUTPUT" 2>&1 | tee -a ffmpeg.log

    echo "❌ Flux arrêté, redémarrage..."
    sleep 3
done
