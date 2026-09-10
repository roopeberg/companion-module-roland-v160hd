# Testing Checklist

Tests to run with live device connected.

Legend: ✅ Verified OK | ⚠️ Unverified | ❌ Known issue

---

## ✅ #1 — RQH 2-byte parameter response size

Confirmed live: all 2-byte PiP parameters (position H/V, size, cropping, view pos H/V, zoom)
require `RQH` size `000002`. Module updated accordingly.

## ✅ #2 — PiP parameter addresses (live verified, PiP 1)

| Param           | Address | Size   | Result          |
|-----------------|---------|--------|-----------------|
| SOURCE          | 001B02  | 1-byte | `29` (Input 10) |
| TYPE            | 001B03  | 1-byte | `00` (PinP)     |
| SHAPE           | 001B0E  | 1-byte | `00` (Rect)     |
| BORDER COLOR    | 001B0F  | 1-byte | `00` (White)    |
| BORDER WIDTH    | 001B10  | 1-byte | `00`            |
| VIEW POS H      | 001B11  | 2-byte | `0000`          |
| VIEW POS V      | 001B13  | 2-byte | `0000`          |
| VIEW ZOOM       | 001B15  | 2-byte | `0064` (100%)   |

## ✅ #3 — PiP Position H/V range

Fixed: -100..+100% (per Control Guide p.7). Verified against live device.

## ⚠️ #4 — Capture / Apply round-trip (PiP)

1. Set PiP 1 to a known position/size on the mixer
2. Press "Capture PiP 1" preset button
3. Verify module variables show correct values
4. Change PiP position on mixer
5. Press "Apply PiP 1" — PiP should return to captured position/size

## ⚠️ #5 — Capture / Apply round-trip (DSK)

Same as above for DSK 1/2.
Captured params: KEY SOURCE (03), FILL SOURCE (04), TYPE (05), LEVEL (06, 2-byte),
GAIN (07), MIX LEVEL (09), MODE (02), PGM SW (00), PVW SW (01).

## ⚠️ #6 — Snapshot save / load / clear

1. Capture PiP 1 settings
2. Press **SAVE / Snap 1** — button should light up (bright orange)
3. Verify file exists at `~/v160hd-snapshots/snapshot1.json`
4. Inspect file — should contain all captured DATA keys for PiP 1
5. Change PiP settings on mixer
6. Press **Snap 1 / PiP 1** — device should restore saved settings
7. Press **CLEAR / Snap 1** — button should dim; file should be deleted

## ⚠️ #7 — PGM / PVW source selection presets

Verify preset buttons change correct source on PGM and PVW buses.
Check tally feedback (bus_tally): red (PGM) / green (PVW) on active source only.
PGM tally must NOT light up when source is on AUX only.
Module polls `002100` (PGM) and `002101` (PVW) at init; feedback is updated immediately on Companion command and on device push.

## ⚠️ #8 — AUX 1–3 source selection presets

Verify preset buttons change AUX output source.
Check orange tally feedback (bus_tally) on active source only.

## ❌ #9 — AUX tally: device hardware panel changes not reflected

When AUX source is changed from the device's own control panel (not via Companion),
the module does not receive a push update. Tally only updates when Companion sends a command.
Fix: implement polling for AUX state. Not yet implemented.

## ⚠️ #14 — Per-bus tally isolation (PGM vs AUX)

Ensure that `bus_tally` feedback for PGM bus does NOT activate when the same source is
active only on AUX1/AUX2/AUX3. Each bus (pgm/pvw/aux1/aux2/aux3) is tracked independently
in `DATA.pgm_source`, `DATA.pvw_source`, `DATA.aux1source` etc.
Variables `pgm_source` and `pvw_source` should reflect the current source label.

## ⚠️ #10 — PiP source / type / shape / border presets

Test preset buttons in Companion for:
- PiP source change (HDMI/SDI/Input)
- PiP type change (PinP / Luma-W / Luma-B / Chroma)
- PiP shape change (Rect / Circle / Diamond)
- PiP border color change (10 colors)

## ⚠️ #11 — DSK source / type presets

Test DSK Key Source, Fill Source, and Type preset buttons.

## ⚠️ #12 — pnpkey_fade addresses (unverified)

Addresses `020305`–`020308` used for PiP fade enable/disable.
Not confirmed against documentation.

## ⚠️ #13 — aux_mute addresses (unverified)

Addresses `012203`, `012503`, `012603` used for AUX mute.
Not confirmed against documentation.
