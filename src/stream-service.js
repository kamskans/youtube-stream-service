const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

class StreamService {
  constructor() {
    this.activeStreams = new Map();
  }

  startStream(streamKey, rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2') {
    const streamId = uuidv4();
    
    const command = ffmpeg()
      .input(':99')
      .inputOptions([
        '-f x11grab',
        '-r 30',
        '-s 1920x1080',
        '-thread_queue_size 512'
      ])
      .input('pulse')
      .inputOptions([
        '-f pulse',
        '-ac 2',
        '-thread_queue_size 512'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset veryfast',
        '-maxrate 3000k',
        '-bufsize 6000k',
        '-pix_fmt yuv420p',
        '-g 60',
        '-c:a aac',
        '-b:a 128k',
        '-ar 44100',
        '-f flv'
      ])
      .output(`${rtmpUrl}/${streamKey}`)
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        this.activeStreams.delete(streamId);
      })
      .on('end', () => {
        console.log('Stream ended');
        this.activeStreams.delete(streamId);
      });

    command.run();
    this.activeStreams.set(streamId, command);
    
    return streamId;
  }

  stopStream(streamId) {
    const command = this.activeStreams.get(streamId);
    if (command) {
      command.kill('SIGTERM');
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  stopAllStreams() {
    for (const [streamId, command] of this.activeStreams) {
      command.kill('SIGTERM');
    }
    this.activeStreams.clear();
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }
}

module.exports = StreamService;