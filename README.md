# companion-module-roland-v160hd

Bitfocus Companion module for the **Roland V-160HD** HD video switcher.

## Requirements

- Roland V-160HD firmware **1.04 or higher**
- A password must be set on the switcher to enable TCP remote control
- Bitfocus Companion **5.x** with `@companion-module/base` **2.1.3**

## Features

- PGM / PVW / AUX 1–3 source selection with per-bus tally feedback
- PiP & Key (1–4): source, type, shape, border, position, size, crop, zoom, level
- DSK (1–2): key/fill source, type, level, gain, mix level
- Capture / Apply / Snapshot workflow for PiP and DSK settings (files saved to `~/v160hd-snapshots/`)
- Memory recall (1–30) with name variables
- Freeze switch control
- AUX mute / link
- PTZ camera control (pan, tilt, zoom, focus, exposure, tally)
- Output / input assignment
- Transition type / mix / wipe control

## Configuration

| Setting       | Value                              |
| ------------- | ---------------------------------- |
| Host          | IP address of the V-160HD          |
| Port          | 8023 (fixed)                       |
| Password      | Must match the switcher's password |
| Polling       | Enable to receive state updates    |
| Polling rate  | ms between polls (minimum 250 ms)  |

**Note:** The V-160HD accepts only one TCP connection at a time. Disconnect
any other control software before connecting this module.

## Documentation

- Full action / feedback / variable / preset reference: [companion/HELP.md](companion/HELP.md)
- Test checklist (live device): [TESTING.md](TESTING.md)
- License: [LICENSE](LICENSE)
