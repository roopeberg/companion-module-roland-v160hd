# Testing Checklist

Tests to run with live device connected.

## #1 — CRITICAL: RQH 2-byte parameter response size

Send: `RQH:001B04,000001;`
Check: Does the device respond with 2 bytes (4 hex chars) or 1 byte (2 hex chars)?

- If **4 hex chars** (e.g. `DTH:001B04,2800;`) → current capture works, no fix needed
- If **2 hex chars** (e.g. `DTH:001B04,28;`) → capturePinp is broken for all position/size/zoom params → fix by changing `000001` to `000002` for 2-byte params

Affected params if broken (all in capturePinp):
- `04` POSITION H, `06` POSITION V
- `08` SIZE, `0A` CROPPING H, `0C` CROPPING V
- `11` VIEW POSITION H, `13` VIEW POSITION V
- `15` VIEW ZOOM

## #2 — PiP Position H/V range

Was: -50..+50% → Fixed to: -100..+100% (per Control Guide p.7)

Test: Set PiP position to -100% and +100% in Companion.
Expected: PiP window moves to extreme left/right edge of screen.

## #3 — Capture / Apply round-trip (PiP)

1. Set PiP 1 to a known position/size on the mixer
2. Press "Capture PiP 1" button in Companion
3. Check that variables `pip1_positionH`, `pip1_positionV`, `pip1_size` show correct values
4. Change PiP position on mixer
5. Press "Apply PiP 1" — PiP should return to captured position

## #4 — Capture / Apply round-trip (DSK)

Same as above for DSK 1/2.
Note: current capture only saves KEY SOURCE, FILL SOURCE, DSK TYPE — not on/off state or levels.

## #5 — PGM / PVW source selection presets

Verify preset buttons in Companion change the correct source on PGM and PVW buses.
Check tally feedback lights up red (PGM) / green (PVW) on active source.

## #6 — AUX 1–3 source selection presets

Verify preset buttons change AUX output source.
Check orange tally feedback on active source.

## #7 — pnpkey_fade addresses (unverified)

Addresses `020305`–`020308` are used for PiP fade enable/disable.
Verify these work — not confirmed against documentation.

## #8 — aux_mute addresses (unverified)

Addresses `012203`, `012503`, `012603` used for AUX mute.
Verify these work — not confirmed against documentation.
