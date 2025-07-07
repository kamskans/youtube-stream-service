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
        this.xvfbProcess = spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], {
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
    // Ensure X server and audio are running
    await this.startXServer();
    await this.startAudioSystem();
    
    console.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Headful mode for audio support
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--display=:99', // Use virtual display
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=IsolateOrigins,site-per-process',
        '--use-fake-ui-for-media-stream', // Auto-accept media permissions
        '--use-fake-device-for-media-stream', // Use fake audio/video devices
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
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
    
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
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