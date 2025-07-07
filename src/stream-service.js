const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

class StreamService {
  constructor() {
    this.activeStreams = new Map();
  }

  startStream(streamKey, rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2') {
    const streamId = uuidv4();
    
    const ffmpegArgs = [
      '-f', 'x11grab',
      '-r', '30',
      '-s', '1920x1080',
      '-thread_queue_size', '512',
      '-i', ':99',
      '-f', 'pulse',
      '-ac', '2',
      '-thread_queue_size', '512',
      '-i', 'v1.monitor',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'flv',
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      `-y`,
      `${rtmpUrl}/${streamKey}`
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log('FFmpeg stdout:', data.toString());
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log('FFmpeg stderr:', data.toString());
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      this.activeStreams.delete(streamId);
    });

    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg error:', err);
      this.activeStreams.delete(streamId);
    });

    this.activeStreams.set(streamId, ffmpegProcess);
    
    return streamId;
  }

  stopStream(streamId) {
    const process = this.activeStreams.get(streamId);
    if (process) {
      process.kill('SIGTERM');
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  stopAllStreams() {
    for (const [streamId, process] of this.activeStreams) {
      process.kill('SIGTERM');
    }
    this.activeStreams.clear();
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }
}

module.exports = StreamService;