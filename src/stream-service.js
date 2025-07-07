const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

class StreamService {
  constructor() {
    this.activeStreams = new Map();
  }

  startStream(streamKey, rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2') {
    const streamId = uuidv4();
    
    const ffmpegArgs = [
      // Video input from X11 - optimized for low resources
      '-f', 'x11grab',
      '-r', '15', // Reduced from 30fps to 15fps
      '-s', '1280x720', // Reduced from 1920x1080 to 720p
      '-thread_queue_size', '256', // Reduced buffer
      '-i', ':99',
      
      // Audio input - optimized
      '-f', 'pulse',
      '-ac', '2',
      '-ar', '44100',
      '-thread_queue_size', '256',
      '-i', 'virtual_output.monitor',
      
      // Video encoding - optimized for low CPU
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Fastest preset
      '-tune', 'zerolatency',
      '-crf', '28', // Lower quality for less CPU
      '-maxrate', '1500k', // Reduced bitrate
      '-bufsize', '3000k', // Reduced buffer
      '-pix_fmt', 'yuv420p',
      '-g', '30', // Reduced keyframe interval
      '-threads', '2', // Limit CPU threads
      
      // Audio encoding - optimized
      '-c:a', 'aac',
      '-b:a', '64k', // Reduced audio bitrate
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