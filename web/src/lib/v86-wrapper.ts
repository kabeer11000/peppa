import V86Starter from "v86";

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

    const defaultOptions: V86Options = {
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      screen_container: container,
      acpi: true,
      autostart: true,
      disable_mouse: false,
      disable_keyboard: false,
    };

    // Add OS-specific options
    const osOptions = this.getOSOptions();
    
    // Merge options
    const mergedOptions = {
      ...defaultOptions,
      ...osOptions,
      ...options,
    };

    // Initialize the emulator
    this.emulator = new V86Starter(mergedOptions);
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isRunning = true;
    this.notifyUpdate();
  }

  private getOSOptions(): Partial<V86Options> {
    switch (this.osType.toLowerCase()) {
      case "linux":
        return {
          cdrom: { url: "/images/linux.iso" },
          boot_order: 0x132, // Boot from CD-ROM first
        };
      case "windows":
        return {
          hda: { url: "/images/windows.img", async: true },
          boot_order: 0x123, // Boot from hard disk first
        };
      case "freedos":
        return {
          fda: { url: "/images/freedos.img", async: true },
          boot_order: 0x321, // Boot from floppy first
        };
      default:
        return {
          cdrom: { url: "/images/linux.iso" },
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
      this.isRunning = false;
      console.log("Emulator stopped");
      this.notifyUpdate();
    });
  }

  public async sendText(text: string): Promise<void> {
    if (!this.emulator || !this.isRunning) return;

    // Add text to keyboard buffer
    this.keyboardBuffer.push(...text.split(''));
    
    // Start processing if not already doing so
    if (!this.processingKeyboard) {
      this.processKeyboardBuffer();
    }
  }

  private async processKeyboardBuffer(): Promise<void> {
    if (!this.emulator || this.keyboardBuffer.length === 0) {
      this.processingKeyboard = false;
      return;
    }

    this.processingKeyboard = true;
    
    // Process one character at a time with a small delay
    const char = this.keyboardBuffer.shift();
    if (char) {
      this.emulator.keyboard_send_text(char);
      
      // Take a screenshot after each key press for AI analysis
      await this.takeScreenshot();
      
      // Small delay between keypresses
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Process next character
    setTimeout(() => this.processKeyboardBuffer(), 50);
  }

  public async sendKey(key: number): Promise<void> {
    if (!this.emulator || !this.isRunning) return;
    
    this.emulator.keyboard_send_scancodes([key]);
    await this.takeScreenshot();
  }

  public async sendSpecialKey(key: string): Promise<void> {
    if (!this.emulator || !this.isRunning) return;
    
    // Map special keys to scancodes
    const keyCodes: Record<string, number[]> = {
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
      "CtrlC": [0x1D, 0x2E, 0x9E, 0xAE], // Press Ctrl, press C, release C, release Ctrl
    };
    
    const codes = keyCodes[key];
    if (codes) {
      this.emulator.keyboard_send_scancodes(codes);
      await this.takeScreenshot();
    }
  }

  public async takeScreenshot(): Promise<string | null> {
    if (!this.emulator || !this.screenContainer) return null;
    
    // Get the canvas element
    const canvas = this.screenContainer.querySelector("canvas");
    if (!canvas) return null;
    
    // Convert canvas to data URL
    this.lastScreenshot = canvas.toDataURL("image/png");
    this.notifyUpdate();
    
    return this.lastScreenshot;
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
    if (!this.emulator) return;
    
    this.emulator.stop();
    this.isRunning = false;
    this.notifyUpdate();
  }

  public resume(): void {
    if (!this.emulator) return;
    
    this.emulator.run();
    this.isRunning = true;
    this.notifyUpdate();
  }

  public destroy(): void {
    if (!this.emulator) return;
    
    this.emulator.stop();
    this.emulator.destroy();
    this.emulator = null;
    this.isRunning = false;
    this.notifyUpdate();
  }

  public onUpdate(callback: (state: V86WrapperState) => void): () => void {
    this.onUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdate(): void {
    const state: V86WrapperState = {
      isRunning: this.isRunning,
      osType: this.osType,
      screenshot: this.lastScreenshot,
    };
    
    this.onUpdateCallbacks.forEach(callback => callback(state));
  }
}

export interface V86WrapperState {
  isRunning: boolean;
  osType: string;
  screenshot: string | null;
}