/* eslint-disable n/no-process-exit */
/**
 * V-160HD live integration test — two-phase design
 *
 * Phase 1: Read ALL addresses and save originals to disk before touching anything.
 * Phase 2: For each parameter: write test value → verify → restore → verify.
 *
 * If the script crashes after phase 1, run restore.js to put everything back.
 *
 * Tests every read/write address used by the module except:
 *   - Macros (500504)              — one-shot trigger, no readable state
 *   - Memory load/save/initialize  — destructive to all device state
 *   - Snapshot file operations     — local filesystem, tested separately
 *   - Camera PTZ/focus/zoom        — stateless movement, no readable position
 *   - Panel switch press/release   — momentary, no state to read back
 *
 * Usage:
 *   node test/integration.js --host 192.168.x.x --password yourpassword [options]
 *
 * Options:
 *   --host       Device IP (required)
 *   --password   Device password (required)
 *   --port       TCP port (default: 8023)
 *   --pip        PiP channel: 1B|1C|1D|1E (default: 1B)
 *   --dsk        DSK channel: 1F|20 (default: 1F)
 *   --only       Comma-separated groups: input,output,pgm,pvw,aux,transition,freeze,pip,dsk
 *   --timeout    Per-read timeout ms (default: 2000)
 *   --delay      Delay between write and verify ms (default: 200)
 *
 * NOTE: Stop Companion before running — device allows only ONE TCP connection.
 */

const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
	process.argv.slice(2).reduce((acc, v, i, arr) => {
		if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] ?? true])
		return acc
	}, []),
)

const HOST = args.host
const PASSWORD = args.password
const PORT = Number(args.port ?? 8023)
const PIP = (args.pip ?? '1B').toUpperCase()
const DSK = (args.dsk ?? '1F').toUpperCase()
const ONLY = args.only ? args.only.split(',') : null
const READ_TIMEOUT = Number(args.timeout ?? 2000)
const WRITE_DELAY = Number(args.delay ?? 200)
const INTER_CMD_GAP = 150 // ms between commands to avoid overwhelming the device

if (!HOST || !PASSWORD) {
	console.error('Usage: node test/integration.js --host <ip> --password <pw>')
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Encode helpers (mirror api.js)
// ---------------------------------------------------------------------------

function encode2(value, scale = 10) {
	const scaled = Math.round(value * scale) & 0x3fff
	const msb = (scaled >> 7) & 0x7f
	const lsb = scaled & 0x7f
	return [msb, lsb].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function encode1s7(value) {
	// Signed 7-bit: mirrors hueWidth encoding in actions.js
	return (Math.round(value) & 0x7f).toString(16).padStart(2, '0').toUpperCase()
}

// ---------------------------------------------------------------------------
// Test parameter definitions
//
// Each entry: { group, label, address, size, testValue }
//   group     — name shown in output and used with --only
//   label     — human-readable description
//   address   — 6-char hex
//   size      — '000001' or '000002'
//   testValue — hex string to write (pre-encoded)
//
// Test value must differ from the most common default to exercise a real write.
// The runner detects if testValue == original and flips the last nibble.
// ---------------------------------------------------------------------------

function buildParams(pip, dsk) {
	const p = pip // e.g. '1B'
	const d = dsk // e.g. '1F'

	// Fade address suffix per PiP channel
	const fadeSuffix = { '1B': '05', '1C': '06', '1D': '07', '1E': '08' }[pip] ?? '05'

	return [
		// ── input assign (INPUT 1–10, addresses 000000–000009) ────────────
		{
			group: 'input',
			label: 'Input 1 assign',
			address: '000000',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 2 assign',
			address: '000001',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 3 assign',
			address: '000002',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 4 assign',
			address: '000003',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 5 assign',
			address: '000004',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 6 assign',
			address: '000005',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 7 assign',
			address: '000006',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 8 assign',
			address: '000007',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 9 assign',
			address: '000008',
			size: '000001',
			testValue: '08',
		},
		{
			group: 'input',
			label: 'Input 10 assign',
			address: '000009',
			size: '000001',
			testValue: '08',
		},

		// ── output assign ─────────────────────────────────────────────────
		{
			group: 'output',
			label: 'HDMI Out 1 assign',
			address: '00000A',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'HDMI Out 2 assign',
			address: '00000B',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'HDMI Out 3 assign',
			address: '00000C',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'SDI Out 1 assign',
			address: '00000D',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'SDI Out 2 assign',
			address: '00000E',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'SDI Out 3 assign',
			address: '00000F',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'output',
			label: 'USB Out assign',
			address: '000010',
			size: '000001',
			testValue: '01',
		},

		// ── PGM / PVW source ──────────────────────────────────────────────
		{
			group: 'pgm',
			label: 'PGM source',
			address: '002100',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pvw',
			label: 'PVW source',
			address: '002101',
			size: '000001',
			testValue: '02',
		},

		// ── AUX source & mute & link ──────────────────────────────────────
		{
			group: 'aux',
			label: 'AUX 1 source',
			address: '000011',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 2 source',
			address: '00002E',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 3 source',
			address: '00002F',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 1 mute',
			address: '012203',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 2 mute',
			address: '012503',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 3 mute',
			address: '012603',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX linked PGM mode',
			address: '02010D',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 1 linked',
			address: '020154',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 2 linked',
			address: '020155',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'aux',
			label: 'AUX 3 linked',
			address: '020156',
			size: '000001',
			testValue: '01',
		},

		// ── Transition ────────────────────────────────────────────────────
		{
			group: 'transition',
			label: 'Transition type Mix/Wipe',
			address: '001800',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'transition',
			label: 'Mix type',
			address: '001801',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'transition',
			label: 'Wipe type',
			address: '001802',
			size: '000001',
			testValue: '02',
		},
		{
			group: 'transition',
			label: 'Wipe direction',
			address: '001803',
			size: '000001',
			testValue: '01',
		},
		{
			group: 'transition',
			label: 'Mix/Wipe transition time',
			address: '001700',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'PiP 1 transition time',
			address: '001701',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'PiP 2 transition time',
			address: '001702',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'PiP 3 transition time',
			address: '001703',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'PiP 4 transition time',
			address: '001704',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'DSK 1 transition time',
			address: '001705',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'DSK 2 transition time',
			address: '001706',
			size: '000001',
			testValue: '14',
		},
		{
			group: 'transition',
			label: 'Output fade time',
			address: '001707',
			size: '000001',
			testValue: '14',
		},

		// ── Freeze ────────────────────────────────────────────────────────
		{
			group: 'freeze',
			label: 'Freeze on/off',
			address: '020500',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze type All/Select',
			address: '020501',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 1',
			address: '020502',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 2',
			address: '020503',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 3',
			address: '020504',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 4',
			address: '020505',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 5',
			address: '020506',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 6',
			address: '020507',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 7',
			address: '020508',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select HDMI IN 8',
			address: '020509',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 1',
			address: '02050A',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 2',
			address: '02050B',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 3',
			address: '02050C',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 4',
			address: '02050D',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 5',
			address: '02050E',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 6',
			address: '02050F',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 7',
			address: '020510',
			size: '000001',
			testValue: '01',
			boolean: true,
		},
		{
			group: 'freeze',
			label: 'Freeze select SDI IN 8',
			address: '020511',
			size: '000001',
			testValue: '01',
			boolean: true,
		},

		// ── PiP ──────────────────────────────────────────────────────────
		{
			group: 'pip',
			label: `PiP ${p} PGM on/off`,
			address: `00${p}00`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} PVW on/off`,
			address: `00${p}01`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} source`,
			address: `00${p}02`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} type`,
			address: `00${p}03`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} position H`,
			address: `00${p}04`,
			size: '000002',
			testValue: encode2(10.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} position V`,
			address: `00${p}06`,
			size: '000002',
			testValue: encode2(10.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} size`,
			address: `00${p}08`,
			size: '000002',
			testValue: encode2(50.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} cropping H`,
			address: `00${p}0A`,
			size: '000002',
			testValue: encode2(5.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} cropping V`,
			address: `00${p}0C`,
			size: '000002',
			testValue: encode2(5.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} shape`,
			address: `00${p}0E`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} border color`,
			address: `00${p}0F`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} border width`,
			address: `00${p}10`,
			size: '000001',
			testValue: '05',
		},
		{
			group: 'pip',
			label: `PiP ${p} view pos H`,
			address: `00${p}11`,
			size: '000002',
			testValue: encode2(5.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} view pos V`,
			address: `00${p}13`,
			size: '000002',
			testValue: encode2(5.0, 10),
		},
		{
			group: 'pip',
			label: `PiP ${p} view zoom`,
			address: `00${p}15`,
			size: '000002',
			testValue: encode2(150, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} key level`,
			address: `00${p}17`,
			size: '000002',
			testValue: encode2(100, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} key gain`,
			address: `00${p}19`,
			size: '000002',
			testValue: encode2(100, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} mix level`,
			address: `00${p}1B`,
			size: '000002',
			testValue: encode2(100, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} chroma color`,
			address: `00${p}1D`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} hue width`,
			address: `00${p}1E`,
			size: '000001',
			testValue: encode1s7(5),
		},
		{
			group: 'pip',
			label: `PiP ${p} hue fine`,
			address: `00${p}1F`,
			size: '000002',
			testValue: encode2(30, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} saturation width`,
			address: `00${p}21`,
			size: '000002',
			testValue: encode2(10, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} saturation fine`,
			address: `00${p}23`,
			size: '000002',
			testValue: encode2(50, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} border R`,
			address: `00${p}25`,
			size: '000002',
			testValue: encode2(128, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} border G`,
			address: `00${p}27`,
			size: '000002',
			testValue: encode2(128, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} border B`,
			address: `00${p}29`,
			size: '000002',
			testValue: encode2(128, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} value width`,
			address: `00${p}2B`,
			size: '000002',
			testValue: encode2(10, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} value fine`,
			address: `00${p}2D`,
			size: '000002',
			testValue: encode2(50, 1),
		},
		{
			group: 'pip',
			label: `PiP ${p} despill`,
			address: `00${p}2F`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'pip',
			label: `PiP ${p} fade enable`,
			address: `0203${fadeSuffix}`,
			size: '000001',
			testValue: '01',
		},

		// ── DSK ──────────────────────────────────────────────────────────
		{
			group: 'dsk',
			label: `DSK ${d} PGM on/off`,
			address: `00${d}00`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} PVW on/off`,
			address: `00${d}01`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} mode`,
			address: `00${d}02`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} key source`,
			address: `00${d}03`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} fill source`,
			address: `00${d}04`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} type`,
			address: `00${d}05`,
			size: '000001',
			testValue: '01',
		},
		{
			group: 'dsk',
			label: `DSK ${d} level`,
			address: `00${d}06`,
			size: '000002',
			testValue: encode2(100, 1),
		},
		{
			group: 'dsk',
			label: `DSK ${d} gain`,
			address: `00${d}07`,
			size: '000001',
			testValue: '64',
		},
		{
			group: 'dsk',
			label: `DSK ${d} mix level`,
			address: `00${d}09`,
			size: '000001',
			testValue: '64',
		},
	]
}

// ---------------------------------------------------------------------------
// TCP connection
// ---------------------------------------------------------------------------

class Device {
	constructor() {
		this.socket = null
		this.buf = ''
		this.waiters = []
	}

	connect() {
		return new Promise((resolve, reject) => {
			const sock = net.createConnection({ host: HOST, port: PORT })
			this.socket = sock
			sock.setEncoding('utf8')

			sock.on('data', (chunk) => {
				this.buf += chunk
				this._flush()
			})
			sock.on('error', reject)
			sock.on('close', () => {
				for (const w of this.waiters) {
					clearTimeout(w.timer)
					w.reject(new Error('Connection closed'))
				}
				this.waiters = []
			})

			this._wait(/Enter password:/, READ_TIMEOUT * 3)
				.then(() => {
					sock.write(PASSWORD + '\n')
					return this._wait(/Welcome to V-160HD/, READ_TIMEOUT * 3)
				})
				.then(resolve)
				.catch(reject)
		})
	}

	_flush() {
		for (let i = this.waiters.length - 1; i >= 0; i--) {
			const w = this.waiters[i]
			if (w.pattern.test(this.buf)) {
				clearTimeout(w.timer)
				this.waiters.splice(i, 1)
				w.resolve(this.buf)
				this.buf = ''
			}
		}
	}

	_wait(pattern, timeout = READ_TIMEOUT) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiters = this.waiters.filter((w) => w.resolve !== resolve)
				reject(new Error(`Timeout waiting for ${pattern} — buffer: ${JSON.stringify(this.buf.slice(-300))}`))
			}, timeout)
			this.waiters.push({ pattern, resolve, reject, timer })
			this._flush()
		})
	}

	async read(address, size = '000001') {
		this.buf = ''
		this.socket.write(`RQH:${address},${size};\n`)
		const reply = await this._wait(new RegExp(`DTH:${address},`))
		const m = reply.match(new RegExp(`DTH:${address},([0-9A-Fa-f]+)`))
		if (!m) throw new Error(`Unexpected reply for ${address}: ${JSON.stringify(reply)}`)
		return m[1].toUpperCase()
	}

	write(address, value) {
		this.socket.write(`DTH:${address},${value};\n`)
	}

	delay(ms) {
		return new Promise((r) => setTimeout(r, ms))
	}
	destroy() {
		this.socket?.destroy()
	}
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const results = []
let currentGroup = ''
const startedAt = new Date()

async function test(label, fn) {
	await new Promise((r) => setTimeout(r, INTER_CMD_GAP))
	const t0 = Date.now()
	try {
		await fn()
		const ms = Date.now() - t0
		console.log(`  ✅  ${label}`)
		passed++
		results.push({
			group: currentGroup,
			label,
			status: 'pass',
			durationMs: ms,
		})
	} catch (err) {
		const ms = Date.now() - t0
		console.log(`  ❌  ${label}`)
		console.log(`       ${err.message}`)
		failed++
		results.push({
			group: currentGroup,
			label,
			status: 'fail',
			error: err.message,
			durationMs: ms,
		})
	}
}

function setGroup(name) {
	currentGroup = name
	console.log(`\n── ${name}`)
}

// When testValue equals the current original, produce a different valid value.
// For boolean fields (only 00/01 valid) flip the bit; otherwise increment the last hex nibble.
function differentiate(testValue, original, isBoolean = false) {
	if (testValue.toUpperCase() !== original.toUpperCase()) return testValue.toUpperCase()
	if (isBoolean) return original.toUpperCase() === '01' ? '00' : '01'
	const last = parseInt(testValue[testValue.length - 1], 16)
	return testValue.slice(0, -1) + ((last + 1) % 16).toString(16).toUpperCase()
}

// ---------------------------------------------------------------------------
// Phase 1: Read all addresses
// ---------------------------------------------------------------------------

async function readAll(dev, params, originalsFile) {
	console.log(`\nVaihe 1 — luetaan ${params.length} osoitetta...`)
	const originals = {}
	let readFailed = 0

	for (const param of params) {
		await dev.delay(INTER_CMD_GAP)
		try {
			const value = await dev.read(param.address, param.size)
			originals[param.address] = {
				value,
				size: param.size,
				label: param.label,
			}
		} catch (err) {
			console.log(`  ⚠️  ${param.address} (${param.label}): ${err.message}`)
			readFailed++
			// Mark as unreadable so phase 2 skips it
			originals[param.address] = {
				value: null,
				size: param.size,
				label: param.label,
				readError: err.message,
			}
		}
		// Write after every read so crash leaves a useful file
		fs.writeFileSync(originalsFile, JSON.stringify(originals, null, 2))
	}

	console.log(`  Luettu: ${params.length - readFailed}/${params.length}  (epäonnistui: ${readFailed})`)
	return originals
}

// ---------------------------------------------------------------------------
// Phase 2: Write → verify → restore → verify
// ---------------------------------------------------------------------------

async function runTests(dev, params, originals) {
	console.log(`\nVaihe 2 — testataan...`)

	let lastGroup = null
	for (const param of params) {
		if (!ONLY || ONLY.includes(param.group)) {
			if (param.group !== lastGroup) {
				setGroup(param.group)
				lastGroup = param.group
			}

			const orig = originals[param.address]
			if (!orig || orig.value === null) {
				await test(param.label, async () => {
					throw new Error(`Ohitettu — luku epäonnistui vaiheessa 1`)
				})
				continue
			}

			const tv = differentiate(param.testValue, orig.value, param.boolean === true)

			await test(param.label, async () => {
				// Write test value
				dev.write(param.address, tv)
				await dev.delay(WRITE_DELAY)

				// Verify change
				const changed = await dev.read(param.address, param.size)
				if (changed !== tv) {
					// Restore before throwing
					dev.write(param.address, orig.value)
					throw new Error(`Kirjoitus ei näkynyt: lähetettiin ${tv}, saatiin ${changed} (oli ${orig.value})`)
				}

				// Restore original
				dev.write(param.address, orig.value)
				await dev.delay(WRITE_DELAY)

				// Verify restore
				const restored = await dev.read(param.address, param.size)
				if (restored !== orig.value) {
					throw new Error(`Palautus epäonnistui: odotettiin ${orig.value}, saatiin ${restored}`)
				}
			})
		}
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const params = buildParams(PIP, DSK)
	const filtered = ONLY ? params.filter((p) => ONLY.includes(p.group)) : params

	console.log(`\nRoland V-160HD integraatiotesti`)
	console.log(`  Host      : ${HOST}:${PORT}`)
	console.log(`  PiP       : ${PIP}   DSK: ${DSK}`)
	console.log(`  Ryhmät    : ${ONLY ? ONLY.join(', ') : 'kaikki'}`)
	console.log(`  Parametrit: ${filtered.length}`)
	console.log(`  Kirjoitusviive: ${WRITE_DELAY} ms`)

	// Prepare results dir
	const resultsDir = process.env.RESULTS_DIR ?? path.join(__dirname, 'results')
	fs.mkdirSync(resultsDir, { recursive: true })
	const ts = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const originalsFile = path.join(resultsDir, `originals-${ts}.json`)
	console.log(`\nAlkuperäiset: ${originalsFile}`)

	// Connect
	const dev = new Device()
	process.stdout.write('\nYhdistetään...')
	try {
		await dev.connect()
		console.log(' OK')
	} catch (err) {
		console.error(`\nYhteys epäonnistui: ${err.message}`)
		process.exit(1)
	}

	// Phase 1
	const originals = await readAll(dev, filtered, originalsFile)

	// Phase 2
	await runTests(dev, filtered, originals)

	dev.destroy()

	// Report
	const finishedAt = new Date()
	const report = {
		host: HOST,
		pip: PIP,
		dsk: DSK,
		groups: ONLY ?? 'all',
		startedAt: startedAt.toISOString(),
		finishedAt: finishedAt.toISOString(),
		durationMs: finishedAt - startedAt,
		summary: { passed, failed, total: passed + failed },
		originalsFile,
		results,
	}

	const reportFile = path.join(resultsDir, `integration-${ts}.json`)
	fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))

	console.log(`\n${'─'.repeat(56)}`)
	console.log(`  Läpi    : ${passed}`)
	console.log(`  Hylätty : ${failed}`)
	console.log(`\nRaportti    : ${reportFile}`)
	console.log(`Alkuperäiset: ${originalsFile}`)

	if (failed > 0) {
		console.log(`\nHylätyt testit:`)
		for (const r of results.filter((r) => r.status === 'fail')) {
			console.log(`  • ${r.label}`)
			console.log(`    ${r.error}`)
		}
		console.log(`\nJos laitteella on väärä tila:`)
		console.log(`  node test/restore.js --host ${HOST} --password <pw> --file ${originalsFile}`)
	}

	process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
