const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

class BrowserService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.xvfbProcess = null;
    this.pulseProcess = null;
  }

  async startXServer() {
    return new Promise((resolve, reject) => {
      // Kill any existing Xvfb processes
      spawn('pkill', ['-f', 'Xvfb'], { stdio: 'ignore' });
      
      setTimeout(() => {
        console.log('Starting Xvfb server...');
        this.xvfbProcess = spawn('Xvfb', [':99', '-screen', '0', '1280x720x24'], {
          stdio: 'pipe'
        });
        
        this.xvfbProcess.on('error', (err) => {
          console.error('Xvfb error:', err);
          reject(err);
        });
        
        // Give Xvfb time to start
        setTimeout(() => {
          console.log('Xvfb started successfully');
          resolve();
        }, 2000);
      }, 1000);
    });
  }

  async startAudioSystem() {
    return new Promise((resolve, reject) => {
      console.log('Starting PulseAudio...');
      
      // Kill any existing pulseaudio processes
      spawn('pkill', ['-f', 'pulseaudio'], { stdio: 'ignore' });
      
      setTimeout(() => {
        this.pulseProcess = spawn('pulseaudio', ['--start', '--exit-idle-time=-1'], {
          stdio: 'pipe'
        });
        
        this.pulseProcess.on('error', (err) => {
          console.error('PulseAudio error:', err);
        });
        
        // Set up virtual audio sink
        setTimeout(() => {
          spawn('pactl', ['load-module', 'module-null-sink', 'sink_name=virtual_output', 'sink_properties=device.description=Virtual_Output'], { stdio: 'ignore' });
          spawn('pactl', ['set-default-sink', 'virtual_output'], { stdio: 'ignore' });
          spawn('pactl', ['set-default-source', 'virtual_output.monitor'], { stdio: 'ignore' });
          
          console.log('Audio system started successfully');
          resolve();
        }, 2000);
      }, 1000);
    });
  }

  async launch() {
    // Start X server for headless browser rendering
    await this.startXServer();
    // Start audio system
    await this.startAudioSystem();
    
    console.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true, // Headless mode for lower resource usage
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--display=:99', // Still use virtual display for X11 capture
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=IsolateOrigins,site-per-process',
        '--use-fake-ui-for-media-stream', // Auto-accept media permissions
        '--use-fake-device-for-media-stream', // Use fake audio/video devices
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    this.page = await this.browser.newPage();
    
    // Grant permissions for camera and microphone
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://2way-app.vercel.app', [
      'microphone',
      'camera',
      'notifications'
    ]);
    
    // Enable audio and disable security restrictions
    await this.page.evaluateOnNewDocument(() => {
      window.chrome = { runtime: {} };
      // Override getUserMedia to always succeed
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return originalGetUserMedia(constraints);
        };
      }
    });
    
    console.log('Browser launched successfully');
  }

  async navigateTo(url) {
    if (!this.page) {
      throw new Error('Browser not launched');
    }
    
    console.log(`Navigating to: ${url}`);
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Take a screenshot to verify page loaded
    try {
      await this.page.screenshot({ path: '/tmp/page-screenshot.png' });
      console.log('Screenshot saved to /tmp/page-screenshot.png');
    } catch (err) {
      console.error('Screenshot failed:', err);
    }
    
    // Check if audio/video elements are present
    const mediaInfo = await this.page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      const audios = document.querySelectorAll('audio');
      const title = document.title;
      
      return {
        title,
        videoCount: videos.length,
        audioCount: audios.length,
        videos: Array.from(videos).map(v => ({
          src: v.src,
          muted: v.muted,
          paused: v.paused,
          duration: v.duration
        })),
        audios: Array.from(audios).map(a => ({
          src: a.src,
          muted: a.muted,
          paused: a.paused,
          duration: a.duration
        }))
      };
    });
    
    console.log('Page media info:', JSON.stringify(mediaInfo, null, 2));
    
    // Try to start any paused media
    await this.page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      const audios = document.querySelectorAll('audio');
      
      [...videos, ...audios].forEach(media => {
        if (media.paused) {
          media.play().catch(e => console.log('Media play failed:', e));
        }
      });
    });
  }

  async close() {
    console.log('Closing browser and services...');
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    // Don't kill X server and audio - keep them running for restart
    console.log('Browser closed, X server and audio kept running for restart');
  }

  async forceRestart() {
    console.log('Force restarting all services...');
    
    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    // Kill and restart X server and audio
    if (this.xvfbProcess) {
      this.xvfbProcess.kill();
      this.xvfbProcess = null;
    }
    
    if (this.pulseProcess) {
      this.pulseProcess.kill();
      this.pulseProcess = null;
    }
    
    // Clean kill any remaining processes
    spawn('pkill', ['-f', 'Xvfb'], { stdio: 'ignore' });
    spawn('pkill', ['-f', 'pulseaudio'], { stdio: 'ignore' });
    
    // Wait a bit then relaunch
    await new Promise(resolve => setTimeout(resolve, 3000));
    await this.launch();
  }

  isActive() {
    return this.browser !== null;
  }
}

module.exports = BrowserService;