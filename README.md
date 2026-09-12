# companion-module-roland-v160hd

Bitfocus Companion module for the **Roland V-160HD** HD video switcher.

## Requirements

- Roland V-160HD firmware **1.04 or higher**
- A password must be set on the switcher to enable TCP remote control
- Bitfocus Companion **5.x** with `@companion-module/base` **2.1.3**

## Features

- **PGM / PVW / AUX 1–3** source selection with per-bus tally feedback (each bus tracked independently); **Multi-tally** preset buttons showing all bus states simultaneously on a single button
- **INPUT/XPT 1–20** — all 20 logical input slots are available as PGM, PVW, and AUX sources (see [INPUT/XPT and panel modes](#inputxpt-slots-and-panel-operation-modes))
- **Source label variables** — device-side labels (HDMI 1–8, SDI 1–8, Still 1–16, PGM, Sub PGM, PVW, AUX 1–3, DSK 1–2 Src) are read at connect and shown on preset buttons automatically; labels can be written from Companion with **Set Device Label**
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

## INPUT/XPT slots and panel operation modes

The V-160HD has two rows of 10 buttons on the hardware panel, giving 20 logical INPUT/XPT slots. Companion exposes all 20 for PGM, PVW, AUX, and PiP source selection. Which physical inputs are routed to which slots depends on the **Panel Operation mode** set on the switcher itself:

| Panel mode | PGM/A row | PST/B row | Notes |
|---|---|---|---|
| **PGM/PST(10)** | INPUT 1–10 → PGM | INPUT 1–10 → PVW | Default mode; each row selects the same 10 sources for its bus |
| **PGM/PST(20)** | INPUT 1–10 → PGM | INPUT 11–20 → PGM | All 20 slots select PGM; PVW controlled separately |
| **PGM(10)/AUX** | INPUT 1–10 → PGM | INPUT 1–10 → AUX | PST row switches an AUX bus instead |

Companion uses the protocol slot IDs (`0x20`–`0x33`) for PGM/PVW selection and the assignment registers (`000000`–`000009`, `000024`–`00002D`) to resolve which physical source (HDMI, SDI, etc.) each slot is mapped to. The panel mode does **not** change which slot IDs are available in Companion — the preset labels simply reflect whatever the operator has assigned to each slot on the device.

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

### Multi-speed polling

A single timer drives three polling tiers instead of querying everything at the same rate:

| Tier | Default interval | Queries | What it updates |
|---|---|---|---|
| **Fast** | every tick (500 ms) | 7 | PiP/Key 1–4 tally × 4, PGM+PVW+AUX sources × 3 |
| **Medium** | every 2nd tick (1 s) | 4 | AUX mutes × 3, one memory slot name |
| **Background** | every 10th tick (5 s) | 9 | PiP sources × 4, freeze × 1, output assigns × 1, AUX links × 2, transition × 1 |

On connect or reconnect all three tiers fire immediately so Companion has full state before the first scheduled tick.

Optimistic updates keep UI feedback instant: feedbacks reflect a user action at the moment of the button press; the next background poll confirms the device state.

Memory slot names cycle continuously (one slot per medium tick ≈ one full pass every 30 s). A save action resets the cycle index so the renamed slot is picked up within one full cycle.

### Net result

| | Original module | This module |
|---|---|---|
| Steady-state queries/s (500 ms rate) | **271 × 2 = 542** | **≈ 19.8** |
| Steady-state queries/s (1 s rate) | **271** | **≈ 9.9** |
| Startup memory-name load | 240 queries | 30 queries (one 8-byte read per slot) |
| Tally-triggered source re-poll | 6 queries (sources + mutes) | 3 queries (sources only, debounced 250 ms) |
| Freeze registers read | 1 (on/off only) | 18 (all select states) |
| PGM/PVW tracked | No | Yes |
| User commands blocked by poll | Yes | Never — priority queue |

## Improvements over upstream

This fork extends and fixes the [original Bitfocus module](https://github.com/bitfocus/companion-module-roland-v160hd).

### New features

| Feature | Details |
|---|---|
| Per-bus tally | PGM, PVW, and AUX 1–3 each have independent tally feedback. The original had no PGM/PVW tracking. |
| Multi-tally buttons | New preset type that shows PGM, PVW, and all three AUX states on a single button. PGM active fills the button red, PVW green; each AUX bus lights a dedicated strip at the bottom. Source type is indicated by a colour bar at the top (HDMI = blue, SDI = orange, Still = purple, XPT = teal). |
| Type-bar styling | All source preset buttons now show a 5 px colour bar at the top indicating the input type. Per-bus buttons use circle tally indicators (top-right corners); cross-bus states are shown alongside so one glance shows the full tally picture. |
| INPUT/XPT 1–20 | All 20 logical input slots exposed for PGM, PVW, AUX, and PiP source selection. Original supported only 10. Assignment registers for slots 11–20 (`000024`–`00002D`) are queried separately at connect. |
| Full freeze select | Control and monitor per-input freeze state for all 18 inputs (HDMI 1–8, SDI 1–8). Original only exposed global freeze on/off. |
| Source label variables | Device-side labels read at connect for all 40 label slots. Variables `label_hdmi_1`–`label_hdmi_8`, `label_sdi_1`–`label_sdi_8`, `label_still_1`–`label_still_16`, `label_pgm`, `label_subpgm`, `label_pvw`, `label_aux1`–`label_aux3`, `label_dsk1src`, `label_dsk2src`. Preset button text updates automatically when a label changes on the device. |
| Set Device Label | Write any of the 40 label slots back to the device from Companion. Variable updated optimistically; a readback query confirms the write. |
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
| PiP source preset option key | All 68 PiP 1–4 source preset buttons passed option key `assign` but the action reads `source`; every preset sent `undefined` as the source value. |
| Memory name NUL termination | Device returns NUL-terminated strings (`MEMORY1\0`). `trimEnd()` does not strip NUL, leaving a trailing invisible character in variable values. Fixed with an explicit `replace(/\0/g, '')` before trimming. |
| DTH 20 ms gap race | The 20 ms rate limit was only enforced when a second command was already queued. If the queue emptied between two rapid commands, `setImmediate` fired the second command immediately (observed 1 ms gap). Fixed by tracking the wall-clock time of the last send via `_lastHighSentAt`. |
| Duplicate `getAuxSources` on action | Actions called `getAuxSources()` and the tally notification triggered a second call milliseconds later — up to 6 queries per source change. Fixed with a 250 ms debounce on `getAuxSources`. |
| `RQH:000110` no data response | USB output assign register was queried every poll cycle but the device never returns a data response, wasting one query per cycle. Removed from steady-state polling. |
| `lastmemorynumber` off-by-one | Device returns a 0-indexed memory number (0–29); the variable exposed the raw value instead of the human-readable slot number (1–30). |
| ERR:N responses unhandled | Only `ERR:0` was caught (and silently ignored); other error codes fell through to the data parser. All `ERR:N` responses are now logged with descriptive messages; `ERR:4` and `ERR:5` (auth failures) log at error level. |
| Unknown PiP source stale label | When the device reported an unrecognised PiP source value the `pnpkeyNsourcename` variable kept its previous value, silently showing the wrong label. Now set to `Unknown (XX)` so the raw value is visible. |
| Login lockout on reconnect | Password was sent every time `Enter password:` arrived on any connection. If TCPHelper reconnected mid-session, a second send could trigger the device's lockout. Fixed with a per-connection `_passwordSent` flag; `Authentication error.` and `Wait a moment.` responses are now caught and logged. |
| Press-and-release timer on disconnect | The 200 ms release command was scheduled with a bare `setTimeout` — if the connection dropped before it fired, the command was sent to a dead socket. Timer handle now stored in `_pressTimer` and cancelled on `socket.on('end')`. |
| Password visible in Companion UI | Config field type was `textinput`, exposing the password in the UI and logs. Changed to `secret-text`; an upgrade script migrates existing saved configs automatically. |
| Feedback scan on every message | `checkAllFeedbacks()` + `checkVariables()` ran after each incoming TCP message. A polling burst of 7–20 messages triggered 7–20 full scans. A 40 ms debounce coalesces each burst into one scan; targeted optimistic-update calls in actions are unaffected. |

## Documentation

- Full action / feedback / variable / preset reference: [companion/HELP.md](companion/HELP.md)
- Test checklist (live device): [TESTING.md](TESTING.md)
- License: [LICENSE](LICENSE)
