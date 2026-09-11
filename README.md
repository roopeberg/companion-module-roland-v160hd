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

| Setting      | Value                              |
| ------------ | ---------------------------------- |
| Host         | IP address of the V-160HD          |
| Port         | 8023 (fixed)                       |
| Password     | Must match the switcher's password |
| Polling      | Enable to receive state updates    |
| Polling rate | ms between polls (300–30 000 ms)   |

**Note:** The V-160HD accepts only one TCP connection at a time. Disconnect
any other control software before connecting this module.

## Protocol communication design

### Priority command queue

All outgoing commands pass through a two-tier in-memory queue instead of being written directly to the socket:

- **High priority** — DTH writes (user-triggered actions such as source switches, freeze on/off, PiP changes). These jump to the front of the queue and are sent one at a time with a minimum **20 ms gap** between consecutive writes, matching Roland's documented Data Set rate limit.
- **Low priority** — RQH read queries (polling). Up to four are drained per 5 ms tick.

This guarantees that a button press is never delayed or lost behind a burst of polling reads.

### Multi-byte queries

The Roland TCP protocol supports reading *N* consecutive bytes in a single `RQH:AAAAAA,NNNNNN` request. The module uses this wherever register addresses are contiguous, replacing multiple individual queries with one:

| Group | Old queries | New |
|---|---|---|
| Freeze state (18 registers) | 18 | 1 |
| HDMI 1–3 + SDI 1–3 output assign | 6 | 1 |
| PGM + PVW source | 2 | 1 |
| Aux 2 + Aux 3 source | 2 | 1 |
| Aux 1–3 link on/off | 3 | 1 |

### Startup-once vs. continuous polling

Data that changes only on explicit user action is read once at connect and then kept in memory via optimistic updates:

- **PiP source** (4 registers) — re-read only when a source-change action is sent.
- **Freeze state** (18 registers) — re-read only when a freeze action is sent.
- **Memory slot names** (30 × 8 characters) — cycled through once at startup; re-read after a memory save.

### Net result

| | Original module | This module |
|---|---|---|
| Queries per poll cycle | **271** (dominated by 240 memory-name reads) | **18** |
| Freeze registers read | 1 (on/off only) | 18 (all select states) |
| PGM/PVW tracked | No | Yes |
| User commands blocked by poll | Yes | Never — priority queue |

## Documentation

- Full action / feedback / variable / preset reference: [companion/HELP.md](companion/HELP.md)
- Test checklist (live device): [TESTING.md](TESTING.md)
- License: [LICENSE](LICENSE)
