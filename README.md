# companion-module-roland-v160hd

Bitfocus Companion module for the **Roland V-160HD** HD video switcher.

## Requirements

- Roland V-160HD firmware **1.04 or higher**
- A password must be set on the switcher to enable TCP remote control
- Bitfocus Companion **5.x** with `@companion-module/base` **2.1.3**

## Features

- **PGM / PVW / AUX 1–3** source selection with per-bus tally feedback (each bus tracked independently)
- **PiP & Key (1–4):** source, type, shape, border, position, size, crop, zoom, level
- **DSK (1–2):** key/fill source, type, level, gain, mix level
- **Freeze:** global on/off, freeze type (All / Select), and per-input freeze select for HDMI 1–8 and SDI 1–8
- **Capture / Apply / Snapshot** workflow — save and restore complete PiP and DSK configurations to `~/v160hd-snapshots/`
- **Memory** recall (slots 1–30) with slot name variables; preset buttons auto-labelled with slot names
- **AUX mute / link**
- **PTZ camera control** — pan, tilt, zoom, focus, exposure, tally
- **Output / input assignment**
- **Transition** type, mix, and wipe control
- **Optimistic updates** — tally, freeze, and source state reflected immediately on button press without waiting for the next poll

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
| PiP/Key 1–4 PGM+PVW tally (per key) | 2 | 1 |
| Memory slot name (8 chars per slot) | 8 | 1 |

### Startup-once vs. continuous polling

Data that changes only on explicit user action is read once at connect and then kept in memory via optimistic updates:

- **PiP source** (4 registers) — re-read only when a source-change action is sent.
- **Freeze state** (18 registers) — re-read only when a freeze action is sent.
- **Memory slot names** (30 × 8 characters) — cycled through once at startup; re-read after a memory save.

### Net result

| | Original module | This module |
|---|---|---|
| Queries per poll cycle (steady-state) | **271** (dominated by 240 memory-name reads/cycle) | **14** |
| Startup memory-name load | 240 queries | 30 queries (one 8-byte read per slot) |
| Tally-triggered source re-poll | 6 queries (sources + mutes) | 3 queries (sources only) |
| Freeze registers read | 1 (on/off only) | 18 (all select states, startup-once) |
| PGM/PVW tracked | No | Yes |
| User commands blocked by poll | Yes | Never — priority queue |

## Improvements over upstream

This fork extends and fixes the [original Bitfocus module](https://github.com/bitfocus/companion-module-roland-v160hd).

### New features

| Feature | Details |
|---|---|
| Per-bus tally | PGM, PVW, and AUX 1–3 each have independent tally feedback. The original had no PGM/PVW tracking. |
| Full freeze select | Control and monitor per-input freeze state for all 18 inputs (HDMI 1–8, SDI 1–8). Original only exposed global freeze on/off. |
| Capture / Apply / Snapshot | Save and restore complete PiP 1–4 and DSK 1–2 configurations as JSON snapshots on disk. |
| Memory presets | Preset buttons auto-labelled with slot names polled from the device. |
| Optimistic updates | Button-press state reflected immediately in feedbacks; no waiting for the next poll cycle. |
| Priority command queue | User actions always sent before polling reads; Roland 20 ms rate limit enforced automatically. |
| Companion 5 API v2 | Full compatibility with `@companion-module/base` 2.x (presets, feedbacks, variables, upgrade scripts). |

### Bug fixes

| Fix | Impact |
|---|---|
| TCP parser rewritten | Incoming data was processed character-by-character with fragile `indexOf` logic; messages split across TCP chunks were silently lost. Replaced with a proper streaming buffer that handles all delimiter types (`;\n`, `\n`, auth prompts) in occurrence order. |
| Auth prompt handling | Module stalled when the `Enter password:` prompt arrived without a trailing newline — common on first connect. |
| Password not logged | Original code logged the plaintext password to the Companion debug console. |
| Memory name decoding | Hex bytes in memory name responses were concatenated as strings instead of being decoded to characters, producing garbage variable values. |
| Poll interval leak | Starting a new poll interval without clearing the old one caused duplicate poll loops after reconnect. |
| `bus_tally` source resolution | INPUT slot IDs were not resolved to their physical source, causing wrong tally colours when inputs were assigned to slots. |
| Socket reconnect race | Destroying the socket and immediately recreating it could result in two live connections. Reconnect now delegated to `TCPHelper` built-in retry. |
| Polling rate clamping | Original accepted any value; module now clamps to 300–30 000 ms and warns when the configured value is adjusted. |
| PiP position range | H/V position range corrected to −100…+100 % per the Roland Control Guide; original used wrong bounds. |
| PiP / DSK RQH byte count | `capturePinp` and `captureDsk` used incorrect byte counts for 2-byte parameters, causing garbled snapshot data. |

## Documentation

- Full action / feedback / variable / preset reference: [companion/HELP.md](companion/HELP.md)
- Test checklist (live device): [TESTING.md](TESTING.md)
- License: [LICENSE](LICENSE)
