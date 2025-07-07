const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class StreamService {
  constructor() {
    this.activeStreams = new Map();
    this.screenshotInterval = null;
  }

  async startScreenshotLoop(browserService, streamId) {
    let frameCount = 0;
    
    this.screenshotInterval = setInterval(async () => {
      try {
        if (!browserService.page) return;
        
        const screenshotPath = `/tmp/frame_${frameCount.toString().padStart(6, '0')}.png`;
        await browserService.page.screenshot({ 
          path: screenshotPath,
          fullPage: false
        });
        frameCount++;
        
        // Keep only last 30 frames to save disk space
        if (frameCount > 30) {
          const oldFramePath = `/tmp/frame_${(frameCount - 30).toString().padStart(6, '0')}.png`;
          if (fs.existsSync(oldFramePath)) {
            fs.unlinkSync(oldFramePath);
          }
        }
      } catch (error) {
        console.error('Screenshot error:', error);
      }
    }, 1000 / 15); // 15 FPS
  }

  startStream(streamKey, rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2', browserService) {
    const streamId = uuidv4();
    
    // Start screenshot loop
    this.startScreenshotLoop(browserService, streamId);
    
    const ffmpegArgs = [
      // Video input from image sequence
      '-f', 'image2',
      '-r', '15',
      '-i', '/tmp/frame_%06d.png',
      
      // Audio input
      '-f', 'pulse',
      '-ac', '2',
      '-ar', '44100',
      '-thread_queue_size', '256',
      '-i', 'virtual_output.monitor',
      
      // Video encoding - optimized for low CPU
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-crf', '28',
      '-maxrate', '1500k',
      '-bufsize', '3000k',
      '-pix_fmt', 'yuv420p',
      '-g', '30',
      '-threads', '2',
      
      // Audio encoding
      '-c:a', 'aac',
      '-b:a', '64k',
      '-ar', '44100',
      '-ac', '2',
      
      // Output format
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',
      
      // Network options
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      
      // Overwrite output
      '-y',
      
      // RTMP URL
      `${rtmpUrl}/${streamKey}`
    ];

    console.log('Starting FFmpeg with args:', ffmpegArgs.join(' '));

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log('FFmpeg stdout:', data.toString());
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log('FFmpeg stderr:', data.toString());
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      this.activeStreams.delete(streamId);
      
      // Stop screenshot loop
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg error:', err);
      this.activeStreams.delete(streamId);
      
      // Stop screenshot loop
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
    });

    this.activeStreams.set(streamId, ffmpegProcess);
    
    return streamId;
  }

  stopStream(streamId) {
    const process = this.activeStreams.get(streamId);
    if (process) {
      process.kill('SIGTERM');
      this.activeStreams.delete(streamId);
      
      // Stop screenshot loop
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
      
      return true;
    }
    return false;
  }

  stopAllStreams() {
    for (const [streamId, process] of this.activeStreams) {
      process.kill('SIGTERM');
    }
    this.activeStreams.clear();
    
    // Stop screenshot loop
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }
}

module.exports = StreamService;