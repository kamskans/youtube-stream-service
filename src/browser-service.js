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
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    this.page = await this.browser.newPage();
    
    // Enable audio
    await this.page.evaluateOnNewDocument(() => {
      window.chrome = { runtime: {} };
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