# Roland V-160HD

This module will allow you to control a Roland V-160HD switcher.

The switcher should be running firmware 1.04 or higher. A password must be set on the switcher in order to enable remote control.

**Note:** The Roland V-160HD accepts only one TCP connection at a time. Disconnect any other control software before using this module.

## Configuration

- Enter the IP address of the device in the configuration settings.
- The device will use TCP port 8023.

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

- **Bus Tally (per bus)** — true when a given source is active on a specific bus (PGM, PVW, AUX1–3). Each bus is tracked independently: PGM tally only lights up when the source is on PGM, not when it is on an AUX bus. PGM, PVW and AUX sources are polled every interval (requires polling enabled) and updated immediately when Companion sends a select command.
- **Tally State** — legacy combined tally (PGM+AUX composite push from device). Kept for backwards compatibility; prefer Bus Tally for new buttons.
- **PnP/Key On Air State** — highlights a button when a PiP/Key channel is active
- **Snapshot File Exists** — true when a named snapshot file is present on disk. Used by Save/Clear preset buttons to indicate whether a slot is occupied.

## Variables

The module exposes variables for all polled state. Key variables include:

- `model`, `version` — device firmware info (set at connect)
- `pgm_source`, `pvw_source` — current PGM / PVW source label (requires polling)
- `aux1`, `aux2`, `aux3` — AUX source labels (requires polling)
- `aux1_mute`, `aux2_mute`, `aux3_mute` — AUX mute state
- `aux1link`, `aux2link`, `aux3link` — AUX link state
- `hdmi1`, `hdmi2`, `hdmi3`, `sdi1`, `sdi2`, `sdi3`, `usb` — output assignments
- `pnpkey1_source`–`pnpkey4_source` — PiP/Key source label (human-readable name, requires polling)
- `memoryname_1`–`memoryname_30` — memory slot names (populated during polling, ~15 s at 500 ms rate)
- `lastmemorynumber`, `lastmemoryname` — last recalled memory slot
- `freeze` — freeze state
- `auxlink_mode` — AUX link mode

> **Note:** Variables that depend on polling (PGM/PVW source, AUX sources, memory names, etc.)
> are only updated while polling is enabled. They will not reflect hardware panel changes
> if polling is disabled.

## Presets

All preset buttons use the Companion 5 layered graphics system with fixed font size (no shrink-to-fit).

- PGM / PVW source selection (HDMI, SDI, Still, XPT inputs) — with tally feedback
- AUX 1–3 source selection — with tally feedback
- PiP 1–4:
  - Capture / Apply
  - Source selection (HDMI 1–8, SDI 1–8, Input 1–10)
  - Type (PinP / Luminance-White Key / Luminance-Black Key / Chroma Key)
  - Shape (Rectangle / Circle / Diamond)
  - Border Color (10 options)
- DSK 1–2:
  - Capture / Apply
  - Key Source selection (HDMI 1–8, SDI 1–8, Still 1–16)
  - Fill Source selection (HDMI 1–8, SDI 1–8, Still 1–16)
  - Type (Luminance-White Key / Luminance-Black Key / Chroma Key)
- Snapshots (5 slots: snapshot1–snapshot5):
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
