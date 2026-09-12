# Roland V-160HD

This module will allow you to control a Roland V-160HD switcher.

The switcher should be running firmware 1.04 or higher. A password must be set on the switcher in order to enable remote control.

**Note:** The Roland V-160HD accepts only one TCP connection at a time. Disconnect any other control software before using this module.

## Configuration

| Setting | Value |
|---|---|
| Host | IP address of the V-160HD |
| Port | 8023 (fixed) |
| Password | Must match the switcher's password (stored securely) |
| Enable Polling | Required for feedbacks and variables |
| Polling Rate | ms between polls (300–30 000, default 500) |
| Verbose Logging | Logs all raw TCP traffic — useful for debugging |

## Actions

- Input 1-10 Assign (HDMI 1-8, SDI 1-8, STILL 1-16)
- Output Assign (HDMI Out 1-3, SDI Out 1-3, USB Out)
- Aux Out Assign
- Aux Out Audio Mute/Unmute
- PGM Layer PnP & Key 1-4 Enable/Disable
- PGM Layer DSK 1&2 Enable/Disable
- SUB PGM Layer PnP & Key 1-4 Enable/Disable
- SUB PGM Layer DSK 1&2 Enable/Disable
- Set Transition Type
- Set Mix Type
- Set Wipe Type
- Set Wipe Direction
- Set PnP and Key Source
- Set PnP and Key Type
- Set DSK Key and Fill Sources
- Set DSK Type
- PGM Select
- PVW Select
- Load/Save Memory Trigger
- PnP & Key:
  - Bus Select
  - Set Source
  - Set Type
  - Position Horizontal/Vertical
  - Key Size
  - Cropping Horizontal/Vertical
  - Shape (Rectangle / Circle / Diamond)
  - Border Color (10 options)
  - Border Width
  - View Position Horizontal/Vertical
  - View Zoom
  - Key Level
  - Key Gain
  - Mix Level
  - Chroma Color
  - Hue Width / Fine
  - Saturation Width / Fine
  - Border Color Red/Green/Blue
- DSK Bus Select
- **Capture PiP / DSK Settings to Variables** — reads all current PiP or DSK parameters from the device into module variables
- **Apply Captured PiP / DSK Settings** — sends the captured variable values back to the device
- **Save Snapshot to File** — saves all captured PiP and DSK values to a named JSON file (`~/v160hd-snapshots/<name>.json`)
- **Load Snapshot from File** — restores variable values from a saved snapshot (does not send to device; use Apply after)
- **Load Snapshot + Apply PiP / DSK** — loads a snapshot and immediately applies it to the selected channel in one step
- **Delete Snapshot File** — permanently removes a snapshot file from disk
- Select PGM Source - Change to Inputs list
- Select PVW Source - Change to Inputs list
- Freeze Switch On / Off / Type / Select Enable/Disable
- Camera PTZ Control:
  - Current Preset
  - Pan Left/Right/Stop
  - Tilt Up/Down/Stop
  - Pan/Tilt Speed
  - Zoom In Fast/Slow / Out Fast/Slow / Stop
  - Camera Focus / Auto Focus On/Off
  - Camera Exposure
  - Camera Set Tally Channel

## Feedbacks

- **Bus Tally (per bus)** — true when a given source is active on a specific bus (PGM, PVW, AUX 1–3). Each bus is tracked independently; PGM tally only lights when the source is on PGM, not on an AUX. Updated immediately on Companion sends and confirmed by the next poll.
- **PnP/Key On Air State** — true when a PiP/Key channel is on or off on PGM or PVW
- **PnP/Key Source State** — true when a PiP/Key channel is assigned to a specific source
- **Aux Mute State** — true when an AUX channel is muted
- **Aux Link Mode** — true when AUX link mode matches the selected setting (Off / Auto Link / Manual Link)
- **Aux Link State** — true when an AUX channel is linked to PGM
- **Output Assign State** — true when an output (HDMI 1–3, SDI 1–3, USB) is assigned to a specific source
- **Freeze State** — true when global freeze is on
- **Freeze Type: Select** — true when Freeze Type is set to Select (not All)
- **Freeze Select: Input Active** — true when a specific input (HDMI 1–8, SDI 1–8) is enabled in Freeze Select mode
- **Freeze Select Mode Active** — true when the dual-function Set Freeze modifier is active
- **Memory Slot: Last Loaded** — true when the given slot (1–30) was the last one recalled
- **Transition Type Active** — true when Mix or Wipe is the active transition type
- **Mix Type Active** — true when the selected mix type is active
- **Wipe Type Active** — true when the selected wipe type is active
- **Wipe Direction Active** — true when the selected wipe direction is active
- **Snapshot File Exists** — true when a named snapshot file is present on disk

> Feedbacks that depend on polled state (bus tally, aux mute, output assign, freeze, memory) require polling to be enabled.

## Variables

The module exposes variables for all polled state. Key variables include:

- `model`, `version` — device firmware info (set at connect)
- `pgm_source`, `pvw_source` — current PGM / PVW source label (requires polling)
- `aux1`, `aux2`, `aux3` — AUX source labels (requires polling)
- `aux1_mute`, `aux2_mute`, `aux3_mute` — AUX mute state
- `aux1link`, `aux2link`, `aux3link` — AUX link state
- `hdmi1`, `hdmi2`, `hdmi3`, `sdi1`, `sdi2`, `sdi3`, `usb` — output assignments
- `pnpkey1_source`–`pnpkey4_source` — PiP/Key source label (human-readable name, requires polling)
- `memoryname_1`–`memoryname_30` — memory slot names (one slot updated per medium poll tick ≈ full 30-slot refresh every 30 s at 500 ms rate)
- `lastmemorynumber`, `lastmemoryname` — last recalled memory slot number (1–30) and its name
- `freeze` — freeze state
- `auxlink_mode` — AUX link mode

> **Note:** Variables that depend on polling (PGM/PVW source, AUX sources, memory names, etc.)
> are only updated while polling is enabled. They will not reflect hardware panel changes
> if polling is disabled.

## Presets

All preset buttons use the Companion 5 layered graphics system with fixed font size (no shrink-to-fit).

- **PGM / PVW source selection** (HDMI, SDI, Still, XPT inputs) — with bus tally feedback
- **AUX 1–3 source selection** — with bus tally feedback
- **PGM + AUX source buttons** — combined preset showing PGM tally plus three coloured squares for AUX 1–3; numbered labels appear on each square only when that AUX is active on the source
- **Memory slots 1–30** — auto-labelled with the slot name polled from the device; `memory_active` feedback highlights the last-loaded slot
- **Freeze:**
  - Global Freeze On / Off toggle
  - Freeze Type toggle (All / Select)
  - Set Freeze mode — dual-function modifier; hold to enter Set Freeze mode, tap an input button to toggle that input's freeze select state
  - Per-input Freeze Select buttons (HDMI 1–8, SDI 1–8) — highlighted when selected
- **Transition:** Type (Mix / Wipe), Mix Type, Wipe Type, Wipe Direction
- **PiP 1–4:**
  - Capture / Apply
  - Source selection (HDMI 1–8, SDI 1–8, Input 1–10)
  - Type (PinP / Luminance-White Key / Luminance-Black Key / Chroma Key)
  - Shape (Rectangle / Circle / Diamond)
  - Border Color (10 options)
- **DSK 1–2:**
  - Capture / Apply
  - Key Source selection (HDMI 1–8, SDI 1–8, Still 1–16)
  - Fill Source selection (HDMI 1–8, SDI 1–8, Still 1–16)
  - Type (Luminance-White Key / Luminance-Black Key / Chroma Key)
- **Snapshots** (5 slots: snapshot1–snapshot5):
  - **Save** — dim when slot is empty, bright orange when occupied
  - **Clear** — dim when slot is empty, bright red when occupied; deletes the file
  - **Load + Apply to PiP 1–4** (5 slots each)
  - **Load + Apply to DSK 1–2** (5 slots each)

### Snapshot security

Snapshot names are validated: only letters, numbers, underscores and hyphens are accepted (`[A-Za-z0-9_-]`). The module verifies that the resolved file path stays inside `~/v160hd-snapshots/` — directory traversal via the name field is not possible.

### Snapshot workflow

1. Set up PiP or DSK parameters on the device
2. Press **Capture PiP/DSK** to read values into module variables
3. Press **SAVE / Snap N** — button lights up to confirm the file was written to `~/v160hd-snapshots/snapshotN.json`
4. Months later, press **Snap N / PiP N** or **Snap N / DSK N** to restore and apply in one step
5. Press **CLEAR / Snap N** to delete a slot — button dims to confirm the file was removed

Snapshot files are plain JSON and can be backed up, renamed, or copied between machines. The file location is `~/v160hd-snapshots/` on the machine running Companion.

## Sponsored By

This module's availability to Companion was sponsored in part by: Lars Erik Pedersen <lars-erik@hotellteknikeren.no>, Jeremy Alysandratos <jjereonimo@gmail.com>, Roope Berg <roope.berg@reloadmedia.fi>, Eric Fetcho <fetcho@gmail.com>, and Gethin Davies <gethindavies@pm.me>
