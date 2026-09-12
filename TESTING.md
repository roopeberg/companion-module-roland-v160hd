# Testing Checklist

Tests to run with live device connected unless otherwise noted.

Legend: ✅ Verified OK | ⚠️ Unverified | ❌ Known issue

---

## ✅ #1 — RQH 2-byte parameter response size

Confirmed live: all 2-byte PiP parameters (position H/V, size, cropping, view pos H/V, zoom)
require `RQH` size `000002`. Module updated accordingly.

## ✅ #2 — PiP parameter addresses (live verified, PiP 1)

| Param        | Address | Size   | Result          |
| ------------ | ------- | ------ | --------------- |
| SOURCE       | 001B02  | 1-byte | `29` (Input 10) |
| TYPE         | 001B03  | 1-byte | `00` (PinP)     |
| SHAPE        | 001B0E  | 1-byte | `00` (Rect)     |
| BORDER COLOR | 001B0F  | 1-byte | `00` (White)    |
| BORDER WIDTH | 001B10  | 1-byte | `00`            |
| VIEW POS H   | 001B11  | 2-byte | `0000`          |
| VIEW POS V   | 001B13  | 2-byte | `0000`          |
| VIEW ZOOM    | 001B15  | 2-byte | `0064` (100%)   |

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

Requires polling to be enabled.

Verify preset buttons change correct source on PGM and PVW buses.
Check tally feedback (bus_tally): red (PGM) / green (PVW) on active source only.
PGM tally must NOT light up when source is on AUX only.
PGM (`002100`) and PVW (`002101`) are polled every interval via `getAuxData()`.
Feedback is also updated immediately when Companion sends a select command.

## ⚠️ #8 — AUX 1–3 source selection presets

Verify preset buttons change AUX output source.
Check tally feedback on active source only (AUX 1 amber, AUX 2 cyan, AUX 3 violet).

## ⚠️ #9 — AUX tally: device hardware panel changes

AUX 1–3 sources (and PGM/PVW) are polled every interval via `getAuxData()`.
Hardware panel changes are reflected on the next poll cycle. There is no
push notification from the device for AUX source changes.

## ⚠️ #10 — Per-bus tally isolation (PGM vs AUX)

Ensure that `bus_tally` feedback for PGM bus does NOT activate when the same source is
active only on AUX1/AUX2/AUX3. Each bus (pgm/pvw/aux1/aux2/aux3) is tracked independently
in `DATA.pgm_source`, `DATA.pvw_source`, `DATA.aux1source` etc.
Variables `pgm_source` and `pvw_source` should reflect the current source label.

## ⚠️ #11 — PiP source / type / shape / border presets

Test preset buttons in Companion for:

- PiP source change (HDMI/SDI/Input)
- PiP type change (PinP / Luma-W / Luma-B / Chroma)
- PiP shape change (Rect / Circle / Diamond)
- PiP border color change (10 colors)

## ⚠️ #12 — DSK source / type presets

Test DSK Key Source, Fill Source, and Type preset buttons.

## ⚠️ #13 — pnpkey_fade addresses (doc-confirmed, live-unverified)

Addresses `020305`–`020308` used for PiP fade enable/disable.
Confirmed against Roland Control Guide documentation; not yet verified against a live device.

## ⚠️ #14 — aux_mute addresses (doc-confirmed, live-unverified)

Addresses `012203`, `012503`, `012603` used for AUX mute.
Confirmed against Roland Control Guide documentation; not yet verified against a live device.

## ⚠️ #15 — TCP receive buffer (split/merged packets)

Verify that authentication and data parsing work correctly when the device
sends responses in multiple TCP segments or merges several responses into one
packet. Test by connecting over a high-latency or congested network.
Expected: auth succeeds, tally and variable values are always correct.

Fix applied: the parser processes delimiters (`;`, `\n`, auth prompts) in
occurrence order. Each delimiter type is handled as soon as it is encountered
rather than in a fixed type priority. Incomplete trailing messages are kept
in the buffer for the next TCP chunk. 23 automated unit tests cover
split packets, merged packets, interleaved delimiter types, and auth prompt
edge cases.

## ⚠️ #16 — Memory names displayed correctly

Requires polling to be enabled.

Memory names are fetched one slot (one 8-byte RQH block) per poll cycle, cycling
through all 30 slots. At 1 s polling, all 30 names populate within ~30 s.
Memory names are not fetched at all when polling is disabled.

1. Enable polling (≥ 300 ms rate)
2. Assign names to memories 1–5 on the device
3. Connect module and wait ~30 s — names should appear in variables `memoryname_1` … `memoryname_5`
4. Verify the names show actual text (not hex digits like `41 42 43`)
5. Verify names with fewer than 8 characters have no trailing spaces in the variable

## ⚠️ #17 — Polling timer does not duplicate on config save

1. Enable polling (1000 ms)
2. Open Companion connection settings and save without changes
3. Monitor device traffic — poll rate should remain ~1/s, not double or triple

## ⚠️ #18 — Polling rate validation

Valid range: 300–30 000 ms. Default when omitted or invalid: 500 ms.

1. Set polling rate to `0`, empty, or a non-numeric value (e.g. `abc`)
2. Save settings — Companion log should show a warning and use 500 ms
3. Set polling rate to `100` — log should show clamped to 300 ms
4. Monitor device traffic — poll rate should match the clamped value

## ✅ #19 — Password not logged

Verified: `self.log('info', 'Sending passcode')` no longer includes the password value.

## ⚠️ #20 — Freeze select mode

Requires polling enabled and Freeze Type set to Select on the device.

1. Press the **Set Freeze** button — the button border and bar should turn cyan (freeze_select_mode_active feedback)
2. While Set Freeze is active, tap an input button (e.g. HDMI IN 1) — that input's freeze state should toggle
3. Per-input Freeze Select buttons (HDMI 1–8, SDI 1–8) should show cyan when the input is frozen
4. Tapping an input button while NOT in Set Freeze mode should select it as the PGM/PVW/AUX source as normal

## ⚠️ #21 — PGM + AUX preset buttons

1. Load the **PGM + AUX** preset section into a page
2. Select a source on PGM — the corresponding button background should turn red
3. Select the same source on AUX 1 — the lower-left square of that button should turn red; the number `1` should appear on the square
4. Select on AUX 2 — middle square; AUX 3 — right square
5. Remove the source from an AUX — the square should return to dark and the number should disappear

## ⚠️ #22 — `lastmemorynumber` shows 1-indexed slot

1. Recall memory slot 1 on the device
2. Verify variable `lastmemorynumber` shows `1` (not `0`)
3. Recall memory slot 30 — variable should show `30` (not `29`)
4. `memory_active` feedback for slot 1 should be true after step 2

## ⚠️ #23 — ERR:N responses logged

1. Enable verbose logging
2. Trigger a known error condition (e.g. send an out-of-range value via a custom action)
3. Companion log should show a descriptive warn-level message (e.g. `Parameter error — value out of range` for ERR:1)
4. ERR:4 / ERR:5 should log at error level

## ⚠️ #24 — Login lockout guard

1. Configure correct password, connect, verify authenticated
2. Monitor debug log — `Sending passcode` should appear exactly once per connection
3. Force a reconnect (disable/re-enable polling) — passcode should be sent exactly once on the new connection

## ⚠️ #25 — Password hidden in Companion UI

1. Open module configuration in Companion
2. Verify the Password field shows masked input (dots), not plaintext
3. Open Companion debug log — password value must not appear in any log line

---

## Notes

- **Unit tests**: `npm test` runs 23 automated tests for the TCP parser
  (`test/tcpParser.test.js`), covering split packets, merged packets, auth prompts,
  interleaved message types, and delimiter-ordering edge cases.
  Snapshot round-trips and live-device protocol flows still require manual testing.
