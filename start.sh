#!/bin/bash

###############################################
# CONFIGURATION
###############################################

# URL de la vidéo (GitHub Releases)
VIDEO_URL="https://github.com/lesptisakhi/live-infinie-coran/releases/download/video/video.mp4"
VIDEO_FILE="video.mp4"

# RTMP de test (Livepeer)
YOUTUBE_URL="rtmp://rtmp.livepeer.com/live/TEST"

# Fichiers internes
LOG_FILE="logs.txt"
RESTART_FILE="restarts.txt"
FLAG_FILE="restart.flag"

###############################################
# INITIALISATION
###############################################

# Créer compteur de redémarrages si absent
if [ ! -f "$RESTART_FILE" ]; then
    echo "0" > "$RESTART_FILE"
fi

# Télécharger la vidéo une seule fois
if [ ! -f "$VIDEO_FILE" ]; then
    echo "[INFO] Téléchargement de la vidéo..." | tee -a "$LOG_FILE"
    curl -L "$VIDEO_URL" -o "$VIDEO_FILE"
    echo "[INFO] Téléchargement terminé." | tee -a "$LOG_FILE"
fi

###############################################
# BOUCLE INFINIE (AUTO-RESTART)
###############################################

while true; do

    ###########################################
    # Gestion du compteur de redémarrages
    ###########################################
    current=$(cat "$RESTART_FILE")
    echo $((current + 1)) > "$RESTART_FILE"

    # Si un restart manuel a été demandé
    if [ -f "$FLAG_FILE" ]; then
        echo "[INFO] Restart manuel détecté." | tee -a "$LOG_FILE"
        rm "$FLAG_FILE"
    fi

    ###########################################
    # Lancement du live
    ###########################################
    echo "[INFO] Démarrage du live RTMP..." | tee -a "$LOG_FILE"

    ffmpeg -re -i "$VIDEO_FILE" \
    -vcodec libx264 -preset veryfast -pix_fmt yuv420p \
    -b:v 3500k -maxrate 3500k -bufsize 7000k \
    -vf "scale=1280:720" \
    -acodec aac -b:a 128k -ar 44100 \
    -f flv "$YOUTUBE_URL" >> "$LOG_FILE" 2>&1

    ###########################################
    # Si FFmpeg s'arrête
    ###########################################
    echo "[WARN] FFmpeg s'est arrêté. Redémarrage dans 5 secondes..." | tee -a "$LOG_FILE"
    sleep 5

done
