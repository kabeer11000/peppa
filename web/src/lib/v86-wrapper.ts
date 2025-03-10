export type V86Options = {
  memory_size?: number;
  vga_memory_size?: number;
  screen_container: HTMLDivElement | null;
  bios?: { url: string };
  vga_bios?: { url: string };
  cdrom?: { url: string };
  hda?: { url: string; size?: number; async?: boolean };
  fda?: { url: string; async?: boolean };
  boot_order?: number;
  initial_state?: { url: string };
  filesystem?: { baseurl: string; basefs: string };
  autostart?: boolean;
  disable_mouse?: boolean;
  disable_keyboard?: boolean;
  network_relay_url?: string;
  acpi?: boolean;
  wasm_path?: string;
};

// Add V86 to the window type
declare global {
  interface Window {
    V86: any;
    V86Starter: any;
  }
}

export interface V86WrapperState {
  isRunning: boolean;
  osType: string;
  screenshot: string | null;
  status: string;
  memoryUsage: number;
  networkActive: boolean;
  bootProgress: number;
  lastAction: string;
}

export class V86Wrapper {
  private emulator: any = null;
  private screenContainer: HTMLDivElement | null = null;
  private osType: string;
  private isRunning: boolean = false;
  private keyboardBuffer: string[] = [];
  private processingKeyboard: boolean = false;
  private lastScreenshot: string | null = null;
  private onUpdateCallbacks: Array<(state: V86WrapperState) => void> = [];
  private eventListeners: { event: string; callback: (...args: any[]) => void }[] = [];
  private status: string = 'initializing';
  private memoryUsage: number = 0;
  private networkActive: boolean = false;
  private bootProgress: number = 0;
  private lastAction: string = '';

  constructor(osType: string = "linux") {
    this.osType = osType;
  }

  public async init(container: HTMLDivElement, options: Partial<V86Options> = {}): Promise<void> {
    if (!container) {
      throw new Error("Container is required");
    }

    // Ensure container is in the DOM
    if (!document.body.contains(container)) {
      throw new Error("Container must be mounted in the DOM");
    }

    this.screenContainer = container;
    this.status = 'loading v86';
    this.notifyUpdate();
    console.log('[V86] Starting initialization');

    // Load v86 script if not already loaded
    if (!window.V86 && !window.V86Starter) {
      try {
        console.log('[V86] Loading v86 script');
        await this.loadV86Scripts();
      } catch (error) {
        this.status = 'failed to load v86';
        this.notifyUpdate();
        console.error('[V86] Script loading failed:', error);
        throw error;
      }
    }

    // Check for V86 or V86Starter
    const V86Class = window.V86 || window.V86Starter;
    if (!V86Class) {
      this.status = 'v86 not available';
      this.notifyUpdate();
      throw new Error("V86 not loaded. Make sure libv86.js is loaded correctly.");
    }

    console.log('[V86] Script loaded, preparing configuration');

    const defaultOptions: V86Options = {
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      screen_container: container,
      acpi: true,
      autostart: true,
      disable_mouse: false,
      disable_keyboard: false,
      wasm_path: '/v86/v86.wasm',
    };

    // Add OS-specific options
    const osOptions = this.getOSOptions();
    console.log('[V86] Using OS options:', osOptions);
    
    // Create the emulator instance
    try {
      this.status = 'creating emulator';
      this.notifyUpdate();

      const finalOptions = {
        ...defaultOptions,
        ...osOptions,
        ...options,
      };
      console.log('[V86] Final emulator options:', finalOptions);

      // Verify required files exist before initialization
      await this.verifyRequiredFiles(finalOptions);

      // @ts-ignore - V86 is loaded dynamically
      this.emulator = new V86Class(finalOptions);
      console.log('[V86] Emulator instance created');

      // Set up event listeners
      this.setupEventListeners();
      
      this.isRunning = true;
      this.status = 'initializing';
      this.notifyUpdate();

      // Wait for emulator to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Emulator initialization timeout'));
        }, 30000); // 30 second timeout

        this.emulator.add_listener("emulator-ready", () => {
          clearTimeout(timeout);
          console.log('[V86] Emulator ready event received');
          resolve();
        });

        // Add error listener
        this.emulator.add_listener("error", (error: any) => {
          console.error('[V86] Emulator error:', error);
          clearTimeout(timeout);
          reject(new Error(`Emulator error: ${error}`));
        });
      });

    } catch (error) {
      this.status = 'initialization failed';
      this.notifyUpdate();
      console.error("[V86] Failed to initialize emulator:", error);
      throw new Error(`Failed to initialize v86 emulator: ${error}`);
    }
  }

  private async loadV86Scripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create script element for the main v86 library
        const script = document.createElement('script');
        script.src = '/v86/libv86.js';
        script.async = true;
        script.onload = () => {
          console.log("v86 library loaded successfully");
          resolve();
        };
        script.onerror = (err) => {
          console.error("Failed to load v86 library:", err);
          reject(new Error("Failed to load v86 library"));
        };
        document.head.appendChild(script);
      } catch (err) {
        console.error("Error loading v86 scripts:", err);
        reject(err);
      }
    });
  }

  private getOSOptions(): Partial<V86Options> {
    switch (this.osType.toLowerCase()) {
      case "linux":
        return {
          cdrom: { url: "/v86/images/linux.iso" },
          bios: { url: "/v86/bios/seabios.bin" },
          vga_bios: { url: "/v86/bios/vgabios.bin" },
          boot_order: 0x132, // Boot from CD-ROM first
        };
      case "windows":
        return {
          hda: { url: "/v86/images/windows.img", async: true },
          bios: { url: "/v86/bios/seabios.bin" },
          vga_bios: { url: "/v86/bios/vgabios.bin" },
          boot_order: 0x123, // Boot from hard disk first
        };
      case "freedos":
        return {
          fda: { url: "/v86/images/freedos.img", async: true },
          bios: { url: "/v86/bios/seabios.bin" },
          vga_bios: { url: "/v86/bios/vgabios.bin" },
          boot_order: 0x321, // Boot from floppy first
        };
      default:
        return {
          cdrom: { url: "/v86/images/linux.iso" },
          bios: { url: "/v86/bios/seabios.bin" },
          vga_bios: { url: "/v86/bios/vgabios.bin" },
          boot_order: 0x132,
        };
    }
  }

  private async verifyRequiredFiles(options: V86Options): Promise<void> {
    const filesToCheck = [];
    
    if (options.bios?.url) filesToCheck.push(options.bios.url);
    if (options.vga_bios?.url) filesToCheck.push(options.vga_bios.url);
    if (options.cdrom?.url) filesToCheck.push(options.cdrom.url);
    if (options.hda?.url) filesToCheck.push(options.hda.url);
    if (options.fda?.url) filesToCheck.push(options.fda.url);
    if (options.wasm_path) filesToCheck.push(options.wasm_path);

    console.log('[V86] Verifying required files:', filesToCheck);

    for (const file of filesToCheck) {
      try {
        const response = await fetch(file, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`File ${file} not found (${response.status})`);
        }
        console.log(`[V86] Verified file exists: ${file}`);
      } catch (error) {
        console.error(`[V86] Failed to verify file ${file}:`, error);
        throw new Error(`Required file ${file} is not accessible`);
      }
    }
  }

  private setupEventListeners(): void {
    if (!this.emulator) return;

    const addListener = (event: string, callback: (...args: any[]) => void) => {
      this.eventListeners.push({ event, callback });
      this.emulator.add_listener(event, callback);
    };

    // System events
    addListener("emulator-ready", () => {
      console.log("[V86] Emulator ready");
      this.status = 'ready';
      this.bootProgress = 100;
      this.updateLastAction('System ready');
      this.notifyUpdate();
    });

    addListener("emulator-stopped", () => {
      console.log("[V86] Emulator stopped");
      this.isRunning = false;
      this.status = 'stopped';
      this.updateLastAction('System stopped');
      this.notifyUpdate();
    });

    // Boot and loading events
    addListener("download-progress", (e: any) => {
      console.log("[V86] Download progress:", e);
      this.status = `downloading: ${e.file_name || 'system files'}`;
      this.bootProgress = Math.min(this.bootProgress + 5, 95);
      this.updateLastAction(`Downloading ${e.file_name || 'system files'}`);
      this.notifyUpdate();
    });

    addListener("download-error", (e: any) => {
      console.error("[V86] Download error:", e);
      this.status = 'download error';
      this.updateLastAction(`Failed to download: ${e.file_name}`);
      this.notifyUpdate();
    });

    // Add more detailed boot progress tracking
    addListener("boot", (e: any) => {
      console.log("[V86] Boot event:", e);
      this.status = 'booting';
      this.updateLastAction('System booting');
      this.notifyUpdate();
    });

    addListener("error", (e: any) => {
      console.error("[V86] Error event:", e);
      this.status = 'error';
      this.updateLastAction(`Error: ${e.message || 'Unknown error'}`);
      this.notifyUpdate();
    });

    // Screen events
    addListener("screen-set-mode", () => {
      console.log("[V86] Screen mode changed");
      this.updateLastAction('Screen mode changed');
      this.notifyUpdate();
    });

    addListener("screen-set-size-graphical", (e: any) => {
      console.log("[V86] Screen size changed:", e);
      this.updateLastAction(`Screen size set to ${e.width}x${e.height}`);
      this.notifyUpdate();
    });

    // Memory monitoring
    setInterval(() => {
      if (this.emulator && this.isRunning) {
        try {
          const stats = this.emulator.v86.cpu.devices.memory.stats;
          this.memoryUsage = stats.allocated;
          this.notifyUpdate();
        } catch (error) {
          console.warn('Could not get memory stats:', error);
        }
      }
    }, 1000);
  }

  public async sendText(text: string): Promise<void> {
    if (!this.emulator || !this.isRunning) return;

    // Add to keyboard buffer
    this.keyboardBuffer.push(...text.split(''));
    
    // Start processing if not already
    if (!this.processingKeyboard) {
      this.processKeyboardBuffer();
    }
  }

  private async processKeyboardBuffer(): Promise<void> {
    if (this.processingKeyboard || this.keyboardBuffer.length === 0) return;
    
    this.processingKeyboard = true;
    
    try {
      while (this.keyboardBuffer.length > 0) {
        const char = this.keyboardBuffer.shift();
        if (!char) continue;
        
        // Send character to emulator
        this.emulator.keyboard_send_text(char);
        
        // Small delay between key presses to avoid overloading
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Error processing keyboard input:", error);
    } finally {
      this.processingKeyboard = false;
    }
  }

  public async sendKey(key: number): Promise<void> {
    if (!this.emulator || !this.isRunning) return;
    
    this.emulator.keyboard_send_scancode(key);
  }

  public async sendSpecialKey(key: string): Promise<void> {
    if (!this.emulator || !this.isRunning) return;
    
    // Map common key names to scancodes
    const keyMap: Record<string, number[]> = {
      "Enter": [0x1C],
      "Tab": [0x0F],
      "Escape": [0x01],
      "Backspace": [0x0E],
      "ArrowUp": [0xE0, 0x48],
      "ArrowDown": [0xE0, 0x50],
      "ArrowLeft": [0xE0, 0x4B],
      "ArrowRight": [0xE0, 0x4D],
      "Home": [0xE0, 0x47],
      "End": [0xE0, 0x4F],
      "PageUp": [0xE0, 0x49],
      "PageDown": [0xE0, 0x51],
      "Delete": [0xE0, 0x53],
      "Insert": [0xE0, 0x52],
      "ControlLeft": [0x1D],
      "AltLeft": [0x38],
      "ShiftLeft": [0x2A],
      "MetaLeft": [0xE0, 0x5B], // Windows key
    };
    
    const codes = keyMap[key];
    if (codes) {
      for (const code of codes) {
        // Press and release the key
        this.emulator.keyboard_send_scancode(code);
        await new Promise(resolve => setTimeout(resolve, 10));
        this.emulator.keyboard_send_scancode(code | 0x80); // Release code
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  public async takeScreenshot(): Promise<string | null> {
    if (!this.emulator || !this.isRunning) return null;
    
    try {
      // Get the screen canvas
      const canvas = this.screenContainer?.querySelector("canvas");
      if (canvas) {
        this.lastScreenshot = canvas.toDataURL("image/png");
        this.notifyUpdate();
        return this.lastScreenshot;
      }
      return null;
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return null;
    }
  }

  public getScreenshot(): string | null {
    return this.lastScreenshot;
  }

  public isEmulatorRunning(): boolean {
    return this.isRunning;
  }

  public getOSType(): string {
    return this.osType;
  }

  public restart(): void {
    if (!this.emulator) return;
    
    this.emulator.restart();
    this.isRunning = true;
    this.notifyUpdate();
  }

  public stop(): void {
    if (!this.emulator || !this.isRunning) return;
    
    this.emulator.stop();
    this.isRunning = false;
    this.notifyUpdate();
  }

  public resume(): void {
    if (!this.emulator || this.isRunning) return;
    
    this.emulator.run();
    this.isRunning = true;
    this.notifyUpdate();
  }

  public destroy(): void {
    if (!this.emulator) return;
    
    // Stop the emulator
    if (this.isRunning) {
      try {
        this.emulator.stop();
      } catch (error) {
        console.error("Error stopping emulator:", error);
      }
    }
    
    // Remove event listeners
    for (const { event, callback } of this.eventListeners) {
      try {
        this.emulator.remove_listener(event, callback);
      } catch (error) {
        console.error(`Error removing listener for ${event}:`, error);
      }
    }
    this.eventListeners = [];
    
    // Clear references
    this.emulator = null;
    this.screenContainer = null;
    this.isRunning = false;
    this.lastScreenshot = null;
    
    this.notifyUpdate();
  }

  public onUpdate(callback: (state: V86WrapperState) => void): () => void {
    this.onUpdateCallbacks.push(callback);
    
    // Initial update
    callback(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdate(): void {
    const state = this.getState();
    this.onUpdateCallbacks.forEach(callback => callback(state));
  }

  private getState(): V86WrapperState {
    return {
      isRunning: this.isRunning,
      osType: this.osType,
      screenshot: this.lastScreenshot,
      status: this.status,
      memoryUsage: this.memoryUsage,
      networkActive: this.networkActive,
      bootProgress: this.bootProgress,
      lastAction: this.lastAction
    };
  }

  // Update action tracking
  public updateLastAction(action: string): void {
    this.lastAction = action;
    this.notifyUpdate();
  }
}