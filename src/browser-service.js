const puppeteer = require('puppeteer');

class BrowserService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async launch() {
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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  isActive() {
    return this.browser !== null;
  }
}

module.exports = BrowserService;