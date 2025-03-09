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

export class V86Wrapper {
  private emulator: any = null;
  private screenContainer: HTMLDivElement | null = null;
  private osType: string;
  private isRunning: boolean = false;
  private keyboardBuffer: string[] = [];
  private processingKeyboard: boolean = false;
  private lastScreenshot: string | null = null;
  private onUpdateCallbacks: Array<(state: V86WrapperState) => void> = [];

  constructor(osType: string = "linux") {
    this.osType = osType;
  }

  public async init(container: HTMLDivElement, options: Partial<V86Options> = {}): Promise<void> {
    this.screenContainer = container;

    // Load v86 from the public directory
    if (typeof window !== 'undefined') {
      // Dynamically load the v86 library from the public folder
      if (!window.V86) {
        throw new Error("V86 not loaded. Make sure libv86.js is loaded correctly.");
      }

      const defaultOptions: V86Options = {
        memory_size: 128 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: container,
        acpi: true,
        autostart: true,
        disable_mouse: false,
        disable_keyboard: false,
        wasm_path: '/v86/v86.wasm', // Path to WebAssembly file in public directory
      };

      // Add OS-specific options
      const osOptions = this.getOSOptions();
      
      // Create the emulator instance
      try {
        // @ts-ignore - V86 is loaded dynamically
        this.emulator = new window.V86({
          ...defaultOptions,
          ...osOptions,
          ...options,
        });

        // Set up event listeners
        this.setupEventListeners();
        
        this.isRunning = true;
        this.notifyUpdate();
      } catch (error) {
        console.error("Failed to initialize v86 emulator:", error);
        throw new Error(`Failed to initialize v86 emulator: ${error}`);
      }
    } else {
      throw new Error("V86 can only be initialized in browser environment");
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

  private setupEventListeners(): void {
    if (!this.emulator) return;

    // Add event listeners for emulator state changes
    this.emulator.add_listener("emulator-ready", () => {
      console.log("Emulator ready");
      this.notifyUpdate();
    });

    this.emulator.add_listener("emulator-stopped", () => {
      console.log("Emulator stopped");
      this.isRunning = false;
      this.notifyUpdate();
    });
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
      this.emulator.stop();
    }
    
    // Clear event listeners
    this.emulator.remove_all_listeners();
    this.emulator = null;
    this.isRunning = false;
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
      screenshot: this.lastScreenshot
    };
  }
}

export interface V86WrapperState {
  isRunning: boolean;
  osType: string;
  screenshot: string | null;
}

// Add V86Starter to the window type
declare global {
  interface Window {
    V86Starter: any;
  }
}