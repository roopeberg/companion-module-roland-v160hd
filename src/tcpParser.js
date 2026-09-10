'use strict'

/**
 * Auth prompts sent by the V-160HD at connection time.
 * These have no reliable terminator (no ';' or '\n'), so they are matched
 * by substring presence rather than by delimiter scanning.
 */
const AUTH_PROMPTS = ['Enter password:', 'Welcome to V-160HD.']

/**
 * Extract all complete messages from `buffer` and return them together with
 * whatever incomplete tail should be kept for the next TCP chunk.
 *
 * Message types (in detection order):
 *   1. Auth prompts  — no terminator; matched as substrings.
 *      Any complete ';'-terminated protocol messages that precede the prompt
 *      are flushed first so they are not discarded.
 *   2. Newline-terminated lines — e.g. VER responses.
 *   3. Semicolon-terminated messages — DTH / RQH protocol responses.
 *      Only complete messages (up to the last ';') are extracted; a partial
 *      trailing message is returned as the new `remaining` buffer.
 *
 * Every extracted message is trimmed. Empty strings are not included.
 *
 * @param {string} buffer  Current accumulated TCP receive buffer.
 * @returns {{ messages: string[], remaining: string }}
 */
function extractMessages(buffer) {
	const messages = []
	let remaining = buffer

	// --- Auth prompts (no terminator) ---
	for (const prompt of AUTH_PROMPTS) {
		const idx = remaining.indexOf(prompt)
		if (idx !== -1) {
			// Flush any complete ';'-terminated messages that come before the prompt.
			if (idx > 0) {
				const before = remaining.slice(0, idx)
				let semi
				let pos = 0
				while ((semi = before.indexOf(';', pos)) !== -1) {
					const msg = before.slice(pos, semi + 1).trim()
					if (msg) messages.push(msg)
					pos = semi + 1
				}
			}
			messages.push(prompt)
			remaining = remaining.slice(idx + prompt.length)
		}
	}

	// --- Newline-terminated lines ---
	let nl
	while ((nl = remaining.indexOf('\n')) !== -1) {
		const msg = remaining.slice(0, nl + 1).trim()
		remaining = remaining.slice(nl + 1)
		if (msg) messages.push(msg)
	}

	// --- Semicolon-terminated protocol messages ---
	// Walk the remaining buffer one ';' at a time so each message is dispatched
	// individually, even when multiple arrive in the same TCP chunk.
	let semi
	let pos = 0
	while ((semi = remaining.indexOf(';', pos)) !== -1) {
		const msg = remaining.slice(pos, semi + 1).trim()
		if (msg) messages.push(msg)
		pos = semi + 1
	}
	// Keep the incomplete tail for the next chunk.
	remaining = remaining.slice(pos)

	return { messages, remaining }
}

module.exports = { extractMessages, AUTH_PROMPTS }
