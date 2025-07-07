FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    wget \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Add NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Install Node.js, Chrome, and other dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    google-chrome-stable \
    xvfb \
    ffmpeg \
    pipewire \
    pipewire-pulse \
    pipewire-audio-client-libraries \
    wireplumber \
    pulseaudio-utils \
    alsa-utils \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-chrome.gpg && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create user for running applications
RUN useradd -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Set environment variables
ENV DISPLAY=:99
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Create startup script
RUN echo '#!/bin/bash\n\
# Start D-Bus\n\
dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address\n\
\n\
# Start Xvfb\n\
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +extension RANDR +extension RENDER &\n\
export DISPLAY=:99\n\
\n\
# Start PipeWire\n\
pipewire &\n\
sleep 2\n\
pipewire-pulse &\n\
sleep 2\n\
wireplumber &\n\
sleep 3\n\
\n\
# Create virtual audio sink\n\
pactl load-module module-null-sink sink_name=virtual_output sink_properties=device.description=Virtual_Output\n\
pactl set-default-sink virtual_output\n\
pactl set-default-source virtual_output.monitor\n\
\n\
# Start the application\n\
cd /app\n\
exec node src/index.js' > /app/start.sh && chmod +x /app/start.sh

# Switch to app user
USER appuser

EXPOSE 3000
CMD ["/app/start.sh"]