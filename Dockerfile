FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV FORCE_REBUILD=1

# Install system dependencies in smaller chunks
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Add NodeSource repository and Chrome repository
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-chrome.gpg && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Node.js and Chrome
RUN apt-get update && apt-get install -y \
    nodejs \
    google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install multimedia dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    ffmpeg \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

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

EXPOSE 3000
CMD ["node", "src/index.js"]