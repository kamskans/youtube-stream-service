const express = require('express');
const BrowserService = require('./browser-service');
const StreamService = require('./stream-service');
require('dotenv').config();

const app = express();
app.use(express.json());

const browserService = new BrowserService();
const streamService = new StreamService();

let currentStreamId = null;

app.post('/api/stream/start', async (req, res) => {
  try {
    const { url, streamKey, rtmpUrl } = req.body;

    if (!url || !streamKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters: url and streamKey' 
      });
    }

    if (currentStreamId) {
      return res.status(409).json({ 
        error: 'Stream already active',
        streamId: currentStreamId 
      });
    }

    // Launch browser if not already active
    if (!browserService.isActive()) {
      await browserService.launch();
    }

    // Navigate to the URL
    await browserService.navigateTo(url);

    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start streaming
    currentStreamId = streamService.startStream(
      streamKey, 
      rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2'
    );

    res.json({ 
      success: true, 
      streamId: currentStreamId,
      message: 'Stream started successfully' 
    });

  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ 
      error: 'Failed to start stream', 
      details: error.message 
    });
  }
});

app.post('/api/stream/stop', async (req, res) => {
  try {
    if (!currentStreamId) {
      return res.status(404).json({ 
        error: 'No active stream found' 
      });
    }

    const stopped = streamService.stopStream(currentStreamId);
    
    if (stopped) {
      currentStreamId = null;
      await browserService.close();
      
      res.json({ 
        success: true, 
        message: 'Stream stopped successfully' 
      });
    } else {
      res.status(404).json({ 
        error: 'Stream not found' 
      });
    }

  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ 
      error: 'Failed to stop stream', 
      details: error.message 
    });
  }
});

app.post('/api/stream/restart', async (req, res) => {
  try {
    const { url, streamKey, rtmpUrl } = req.body;

    if (!url || !streamKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters: url and streamKey' 
      });
    }

    // Stop current stream if running
    if (currentStreamId) {
      streamService.stopStream(currentStreamId);
      currentStreamId = null;
    }

    // Force restart browser and services
    await browserService.forceRestart();

    // Navigate to the URL
    await browserService.navigateTo(url);

    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start streaming
    currentStreamId = streamService.startStream(
      streamKey, 
      rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2'
    );

    res.json({ 
      success: true, 
      streamId: currentStreamId,
      message: 'Stream restarted successfully' 
    });

  } catch (error) {
    console.error('Error restarting stream:', error);
    res.status(500).json({ 
      error: 'Failed to restart stream', 
      details: error.message 
    });
  }
});

app.get('/api/stream/status', (req, res) => {
  res.json({
    active: currentStreamId !== null,
    streamId: currentStreamId,
    browserActive: browserService.isActive(),
    activeStreams: streamService.getActiveStreams()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'youtube-stream-service' 
  });
});

app.get('/api/debug/screenshot', (req, res) => {
  const fs = require('fs');
  const path = '/tmp/page-screenshot.png';
  
  if (fs.existsSync(path)) {
    res.sendFile(path);
  } else {
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

app.get('/api/debug/info', async (req, res) => {
  try {
    if (!browserService.isActive()) {
      return res.json({ 
        error: 'Browser not active',
        browserActive: false 
      });
    }

    // Get page info if browser is running
    const pageInfo = await browserService.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        videoElements: document.querySelectorAll('video').length,
        audioElements: document.querySelectorAll('audio').length,
        bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body'
      };
    });

    res.json({
      browserActive: true,
      currentStreamId,
      activeStreams: streamService.getActiveStreams(),
      pageInfo
    });

  } catch (error) {
    res.json({
      error: error.message,
      browserActive: browserService.isActive(),
      currentStreamId,
      activeStreams: streamService.getActiveStreams()
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`YouTube Stream Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  streamService.stopAllStreams();
  await browserService.close();
  process.exit(0);
});