'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const api = require('../src/api.js')

function makeInstance() {
	const setVarCalls = []
	const inst = {
		DATA: {},
		config: { verbose: false },
		MODEL: '',
		VERSION: '',
		freezeDataLoaded: false,
		pipSourceDataLoaded: false,
		memoryNamesLoaded: false,
		memoryNameIndex: 0,
		CHOICES_PNPKEY_SOURCES: [],
		socket: { send: () => {}, isConnected: true },
		_highQueue: [],
		_lowQueue: [],
		_drainScheduled: false,
		_drainGeneration: 0,
		log: () => {},
		logVerbose: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		checkAllFeedbacks: () => {},
		updateStatus: () => {},
		startInterval: () => {},
		subscribeToTally: () => {},
		getSourceLabels: () => {},
		sendRawCommand: () => {},
		updateTally: () => {},
		resolveInputSource: (v) => v,
		getAuxData: () => {},
		getNextMemoryName: () => {},
		setVariableValues: (obj) => setVarCalls.push(obj),
	}
	inst._parseHexBlock = api._parseHexBlock.bind(inst)
	inst._drainBatch = api._drainBatch.bind(inst)
	inst._clearQueue = api._clearQueue.bind(inst)
	inst._sendDirect = api._sendDirect.bind(inst)
	inst.updateData = api.updateData.bind(inst)
	inst._setVarCalls = setVarCalls
	return inst
}

// Build a DTH message for the LABEL EDIT area (no trailing semicolon —
// tcpParser strips it before calling updateData).
// addr is the p2 byte in hex (e.g. '10' for HDMI IN 1).
// text is a string of up to 8 ASCII chars (padded with null bytes).
function labelMsg(addr, text) {
	const padded = text.padEnd(8, '\0')
	const hex = Array.from(padded)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()
	return `DTH:02${addr}00,${hex}`
}

// ---------------------------------------------------------------------------
// Address → variable key mapping
// ---------------------------------------------------------------------------

describe('source label address mapping', () => {
	test('HDMI IN 1 (0x10) maps to label_hdmi_1', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('10', 'CAM1    '))
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.ok(key, 'expected label_hdmi_1 to be set')
		assert.equal(key.label_hdmi_1, 'CAM1')
	})

	test('HDMI IN 8 (0x17) maps to label_hdmi_8', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('17', 'CAMERA8 '))
		const key = inst._setVarCalls.find((c) => c.label_hdmi_8 !== undefined)
		assert.ok(key, 'expected label_hdmi_8 to be set')
		assert.equal(key.label_hdmi_8, 'CAMERA8')
	})

	test('SDI IN 1 (0x18) maps to label_sdi_1', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('18', 'SDI SRC '))
		const key = inst._setVarCalls.find((c) => c.label_sdi_1 !== undefined)
		assert.ok(key, 'expected label_sdi_1 to be set')
	})

	test('SDI IN 8 (0x1F) maps to label_sdi_8', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('1F', 'SDI8    '))
		const key = inst._setVarCalls.find((c) => c.label_sdi_8 !== undefined)
		assert.ok(key)
	})

	test('Still 1 (0x20) maps to label_still_1', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('20', 'LOGO    '))
		const key = inst._setVarCalls.find((c) => c.label_still_1 !== undefined)
		assert.ok(key)
		assert.equal(key.label_still_1, 'LOGO')
	})

	test('Still 16 (0x2F) maps to label_still_16', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('2F', 'STILL16 '))
		const key = inst._setVarCalls.find((c) => c.label_still_16 !== undefined)
		assert.ok(key)
	})

	test('PGM (0x30) maps to label_pgm', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('30', 'PGM OUT '))
		const key = inst._setVarCalls.find((c) => c.label_pgm !== undefined)
		assert.ok(key)
		assert.equal(key.label_pgm, 'PGM OUT')
	})

	test('AUX 1 (0x33) maps to label_aux1', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('33', 'AUX MON '))
		const key = inst._setVarCalls.find((c) => c.label_aux1 !== undefined)
		assert.ok(key)
	})

	test('AUX 2 (0x3A) maps to label_aux2', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('3A', 'AUX2    '))
		const key = inst._setVarCalls.find((c) => c.label_aux2 !== undefined)
		assert.ok(key)
	})

	test('DSK 1 Source (0x3C) maps to label_dsk1src', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('3C', 'DSK SRC '))
		const key = inst._setVarCalls.find((c) => c.label_dsk1src !== undefined)
		assert.ok(key)
	})

	test('unknown address (0x0F) does not set any variable', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('0F', 'IGNORED '))
		// No label_* variable should have been set
		const labelSet = inst._setVarCalls.some((c) => Object.keys(c).some((k) => k.startsWith('label_')))
		assert.equal(labelSet, false)
	})
})

// ---------------------------------------------------------------------------
// ASCII decoding
// ---------------------------------------------------------------------------

describe('source label ASCII decoding', () => {
	test('trims trailing spaces and null bytes', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('10', 'CAM \0\0\0\0'))
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.ok(key)
		assert.equal(key.label_hdmi_1, 'CAM')
	})

	test('full 8-char label without padding', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('10', 'ABCDEFGH'))
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.ok(key)
		assert.equal(key.label_hdmi_1, 'ABCDEFGH')
	})

	test('empty label (all nulls) does not overwrite variable', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('10', '\0\0\0\0\0\0\0\0'))
		// displayLabel is empty → setVariableValues should NOT be called for this key
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.equal(key, undefined, 'should not set variable for all-null label')
	})

	test('label with only spaces does not overwrite variable', () => {
		const inst = makeInstance()
		inst.updateData(labelMsg('10', '        '))
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.equal(key, undefined, 'should not set variable for all-space label')
	})
})

// ---------------------------------------------------------------------------
// Invalid response handling
// ---------------------------------------------------------------------------

describe('source label invalid response handling', () => {
	test('wrong byte count (not 8 bytes) is silently ignored', () => {
		const inst = makeInstance()
		// Only 4 bytes instead of 8
		inst.updateData('DTH:021000,41424344')
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.equal(key, undefined, 'partial response should not set variable')
	})

	test('non-hex value is silently ignored', () => {
		const inst = makeInstance()
		inst.updateData('DTH:021000,ZZZZZZZZZZZZZZZZ')
		const key = inst._setVarCalls.find((c) => c.label_hdmi_1 !== undefined)
		assert.equal(key, undefined, 'non-hex response should not set variable')
	})
})

// ---------------------------------------------------------------------------
// setSourceLabel — write + optimistic variable update
// ---------------------------------------------------------------------------

describe('setSourceLabel', () => {
	function makeWriteInstance() {
		const setVarCalls = []
		const rawCmds = []
		const warnings = []
		const inst = {
			log: (_l, msg) => {
				if (_l === 'warn') warnings.push(msg)
			},
			logVerbose: () => {},
			setVariableValues: (obj) => setVarCalls.push(obj),
			sendRawCommand: (cmd, priority) => rawCmds.push({ cmd, priority }),
		}
		inst.setSourceLabel = api.setSourceLabel.bind(inst)
		inst._setVarCalls = setVarCalls
		inst._rawCmds = rawCmds
		inst._warnings = warnings
		return inst
	}

	test('encodes text as padded hex and sends DTH high-priority', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', 'CAM 1')
		const dth = inst._rawCmds.find((c) => c.cmd.startsWith('DTH:'))
		assert.ok(dth, 'expected a DTH command')
		assert.equal(dth.priority, 'high')
		// 'CAM 1   ' → 43414D2031202020
		assert.ok(dth.cmd.includes('43414D2031202020'), `unexpected hex in: ${dth.cmd}`)
	})

	test('sends RQH readback low-priority after write', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', 'CAM 1')
		const rqh = inst._rawCmds.find((c) => c.cmd.startsWith('RQH:'))
		assert.ok(rqh, 'expected a readback RQH command')
		assert.equal(rqh.priority, undefined) // default = low
		assert.ok(rqh.cmd.includes('021000'), `unexpected address in: ${rqh.cmd}`)
	})

	test('optimistically updates the Companion variable', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('18', 'ROUTER')
		const v = inst._setVarCalls.find((c) => c.label_sdi_1 !== undefined)
		assert.ok(v, 'expected label_sdi_1 to be set optimistically')
		assert.equal(v.label_sdi_1, 'ROUTER')
	})

	test('truncates text longer than 8 characters', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', 'TOOLONGNAME')
		const dth = inst._rawCmds.find((c) => c.cmd.startsWith('DTH:'))
		// DTH hex value is exactly 16 chars (8 bytes)
		const hexPart = dth.cmd.split(',')[1].replace(';', '')
		assert.equal(hexPart.length, 16, `expected 16 hex chars, got ${hexPart.length}`)
	})

	test('replaces non-printable characters with spaces', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', 'CAM\x01\x7f1')
		const dth = inst._rawCmds.find((c) => c.cmd.startsWith('DTH:'))
		// \x01 and \x7f are not printable ASCII (0x20-0x7E) — become 0x20 (space)
		assert.ok(dth.cmd.includes('43414D'), 'CAM prefix should be encoded correctly')
		assert.ok(dth.cmd.includes('2020'), 'non-printable chars should become spaces')
	})

	test('logs a warning for an unknown address', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('05', 'NOPE')
		assert.ok(inst._warnings.some((w) => w.includes('0x05')))
		assert.equal(inst._rawCmds.length, 0, 'no commands should be sent for unknown address')
	})

	test('handles bus label targets: AUX 2 (0x3A)', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('3A', 'STREAM')
		const v = inst._setVarCalls.find((c) => c.label_aux2 !== undefined)
		assert.ok(v, 'expected label_aux2 to be set')
		assert.equal(v.label_aux2, 'STREAM')
		const dth = inst._rawCmds.find((c) => c.cmd.startsWith('DTH:'))
		assert.ok(dth.cmd.includes('023A00'), `unexpected address in: ${dth.cmd}`)
	})

	test('empty string logs warning and sends no DTH command', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', '')
		assert.ok(
			inst._warnings.some((w) => w.includes('empty label')),
			'expected a warning about empty label',
		)
		assert.equal(
			inst._rawCmds.filter((c) => c.cmd.startsWith('DTH:')).length,
			0,
			'no DTH write should be sent for empty label',
		)
	})

	test('all-whitespace string logs warning and sends no DTH command', () => {
		const inst = makeWriteInstance()
		inst.setSourceLabel('10', '   ')
		assert.ok(
			inst._warnings.some((w) => w.includes('empty label')),
			'expected a warning about empty label',
		)
		assert.equal(
			inst._rawCmds.filter((c) => c.cmd.startsWith('DTH:')).length,
			0,
			'no DTH write should be sent for all-whitespace label',
		)
	})
})
