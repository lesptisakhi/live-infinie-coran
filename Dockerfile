FROM debian:stable

RUN apt update && apt install -y ffmpeg curl nodejs npm

WORKDIR /app
COPY . .

RUN chmod +x start.sh

CMD ["bash", "start.sh"]
