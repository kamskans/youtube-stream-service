# Use a pre-built image with Chrome and dependencies
FROM ghcr.io/puppeteer/puppeteer:22.8.2

# Switch to root to install additional packages
USER root

# Clean up existing Chrome repositories and GPG keys to avoid conflicts
RUN rm -f /etc/apt/sources.list.d/google*.list && \
    rm -f /etc/apt/trusted.gpg.d/google*.gpg && \
    apt-get update

# Install FFmpeg and audio tools (skip Chrome since it's already installed)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    pulseaudio \
    pulseaudio-utils \
    xvfb \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create start script
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1920x1080x24 &\n\
export DISPLAY=:99\n\
pulseaudio --start --exit-idle-time=-1 &\n\
sleep 2\n\
pacmd load-module module-virtual-sink sink_name=v1\n\
pacmd set-default-sink v1\n\
pacmd set-default-source v1.monitor\n\
exec node src/index.js' > /usr/src/app/start.sh && chmod +x /usr/src/app/start.sh

# Switch back to non-root user
USER pptruser

EXPOSE 3000
CMD ["/usr/src/app/start.sh"]