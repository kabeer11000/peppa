declare module 'v86' {
  interface V86StarterOptions {
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
  }

  class V86Starter {
    constructor(options: V86StarterOptions);
    
    // Add methods that are used in V86Wrapper.ts
    destroy(): void;
    restart(): void;
    stop(): void;
    run(): void;
    add_listener(event: string, callback: () => void): void;
    keyboard_send_text(text: string): void;
    keyboard_send_scancodes(codes: number[]): void;
  }

  export default V86Starter;
} 