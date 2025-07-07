# YouTube Stream Service

A service that opens webpages in Chrome (headful mode with virtual display), captures the window with FFmpeg, and streams to YouTube.

## Features

- Headful Chrome running on virtual display (Xvfb) for proper audio support
- FFmpeg screen and audio capture
- YouTube RTMP streaming
- RESTful API for controlling streams
- Railway deployment ready

## API Endpoints

### Start Stream
```bash
POST /api/stream/start
Content-Type: application/json

{
  "url": "https://example.com",
  "streamKey": "your-youtube-stream-key",
  "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2" (optional)
}
```

### Stop Stream
```bash
POST /api/stream/stop
```

### Get Stream Status
```bash
GET /api/stream/status
```

### Health Check
```bash
GET /health
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Install required system dependencies:
```bash
# Ubuntu/Debian
sudo apt-get install -y xvfb ffmpeg pulseaudio google-chrome-stable

# macOS (for testing, won't have virtual display)
brew install ffmpeg
```

4. Run the service:
```bash
npm start
```

## Railway Deployment

1. Create a new project on Railway
2. Connect your GitHub repository
3. Railway will automatically detect the Dockerfile and deploy
4. Set environment variables in Railway dashboard

## Environment Variables

- `PORT` - Server port (default: 3000)

## YouTube Stream Setup

1. Go to YouTube Studio
2. Navigate to "Create" → "Go live"
3. Copy your stream key
4. Use the stream key in the API request

## Technical Details

- Uses Puppeteer with headful Chrome for proper audio support
- Xvfb creates a virtual display to keep Chrome window invisible
- FFmpeg captures both video (X11) and audio (PulseAudio)
- Streams to YouTube via RTMP protocol