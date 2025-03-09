V86 Emulator Files
=================

This directory should contain the V86 emulator files:

1. Place libv86.js in this directory
2. Place v86.wasm in this directory
3. Place BIOS files in the /bios directory:
   - seabios.bin
   - vgabios.bin
4. Place disk images in the /images directory:
   - linux.iso
   - windows.img
   - freedos.img (optional)

Files can be downloaded from:
- https://github.com/copy/v86/releases
- Or build from source at https://github.com/copy/v86

Example structure:
/v86
  ├── libv86.js
  ├── v86.wasm
  ├── /bios
  │   ├── seabios.bin
  │   └── vgabios.bin
  └── /images
      ├── linux.iso
      └── windows.img 