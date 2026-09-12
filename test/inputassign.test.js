'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const api = require('../src/api.js')
const constants = require('../src/constants.js')

function makeInstance(overrides) {
	const rawCmds = []
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
		sendRawCommand: (cmd) => rawCmds.push(cmd),
		updateTally: () => {},
		getAuxData: () => {},
		getNextMemoryName: () => {},
		setVariableValues: () => {},
		...overrides,
	}
	inst._parseHexBlock = api._parseHexBlock.bind(inst)
	inst._drainBatch = api._drainBatch.bind(inst)
	inst._clearQueue = api._clearQueue.bind(inst)
	inst._sendDirect = api._sendDirect.bind(inst)
	inst.updateData = api.updateData.bind(inst)
	inst.getInputAssignData = api.getInputAssignData.bind(inst)
	inst.resolveInputSource = api.resolveInputSource.bind(inst)
	inst._rawCmds = rawCmds
	return inst
}

// ---------------------------------------------------------------------------
// getInputAssignData — address coverage
// ---------------------------------------------------------------------------

describe('getInputAssignData address coverage', () => {
	test('queries INPUT 1 (000000)', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		assert.ok(inst._rawCmds.includes('RQH:000000,000001;'), 'expected INPUT 1 query')
	})

	test('queries INPUT 10 (000009)', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		assert.ok(inst._rawCmds.includes('RQH:000009,000001;'), 'expected INPUT 10 query')
	})

	test('queries INPUT 11 (000024)', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		assert.ok(inst._rawCmds.includes('RQH:000024,000001;'), 'expected INPUT 11 query')
	})

	test('queries INPUT 20 (00002D)', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		assert.ok(inst._rawCmds.includes('RQH:00002D,000001;'), 'expected INPUT 20 query')
	})

	test('issues exactly 20 RQH commands total', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		assert.equal(inst._rawCmds.length, 20)
	})

	test('does NOT query addresses in the gap (00000A–000023)', () => {
		const inst = makeInstance()
		inst.getInputAssignData()
		const gapAddrs = inst._rawCmds.filter((cmd) => {
			const m = cmd.match(/^RQH:0000([0-9A-Fa-f]{2}),/)
			if (!m) return false
			const p3 = parseInt(m[1], 16)
			return p3 >= 0x0a && p3 <= 0x23
		})
		assert.equal(gapAddrs.length, 0, `unexpected gap queries: ${gapAddrs.join(', ')}`)
	})
})

// ---------------------------------------------------------------------------
// resolveInputSource — slot ID → register address mapping
// ---------------------------------------------------------------------------

describe('resolveInputSource slot mapping', () => {
	test('INPUT 1 (id=20): reads cached input_assign_00', () => {
		const inst = makeInstance()
		inst.DATA['input_assign_00'] = '01'
		const result = inst.resolveInputSource('20')
		assert.equal(result, '01')
		assert.equal(inst._rawCmds.length, 0, 'should not fire RQH when cached')
	})

	test('INPUT 10 (id=29): reads cached input_assign_09', () => {
		const inst = makeInstance()
		inst.DATA['input_assign_09'] = '0F'
		const result = inst.resolveInputSource('29')
		assert.equal(result, '0F')
		assert.equal(inst._rawCmds.length, 0)
	})

	test('INPUT 11 (id=2A): reads cached input_assign_24', () => {
		const inst = makeInstance()
		inst.DATA['input_assign_24'] = '08'
		const result = inst.resolveInputSource('2A')
		assert.equal(result, '08')
		assert.equal(inst._rawCmds.length, 0)
	})

	test('INPUT 20 (id=33): reads cached input_assign_2D', () => {
		const inst = makeInstance()
		inst.DATA['input_assign_2D'] = '00'
		const result = inst.resolveInputSource('33')
		assert.equal(result, '00')
		assert.equal(inst._rawCmds.length, 0)
	})

	test('INPUT 1 uncached: fires RQH:000000 and returns original id', () => {
		const inst = makeInstance()
		const result = inst.resolveInputSource('20')
		assert.equal(result, '20')
		assert.ok(
			inst._rawCmds.some((cmd) => cmd.includes('000000')),
			'expected RQH for address 000000',
		)
	})

	test('INPUT 11 uncached: fires RQH:000024 and returns original id', () => {
		const inst = makeInstance()
		const result = inst.resolveInputSource('2A')
		assert.equal(result, '2A')
		assert.ok(
			inst._rawCmds.some((cmd) => cmd.includes('000024')),
			'expected RQH for address 000024',
		)
	})

	test('INPUT 20 uncached: fires RQH:00002D and returns original id', () => {
		const inst = makeInstance()
		const result = inst.resolveInputSource('33')
		assert.equal(result, '33')
		assert.ok(
			inst._rawCmds.some((cmd) => cmd.includes('00002D')),
			'expected RQH for address 00002D',
		)
	})

	test('non-INPUT id (e.g. HDMI, 01) is returned as-is without RQH', () => {
		const inst = makeInstance()
		const result = inst.resolveInputSource('01')
		assert.equal(result, '01')
		assert.equal(inst._rawCmds.length, 0)
	})
})

// ---------------------------------------------------------------------------
// updateData — INPUT assign handler stores correct DATA keys
// ---------------------------------------------------------------------------

describe('updateData INPUT assign handler', () => {
	test('INPUT 1 response (000000) stores input_assign_00', () => {
		const inst = makeInstance()
		inst.updateData('DTH:000000,01')
		assert.equal(inst.DATA['input_assign_00'], '01')
	})

	test('INPUT 10 response (000009) stores input_assign_09', () => {
		const inst = makeInstance()
		inst.updateData('DTH:000009,08')
		assert.equal(inst.DATA['input_assign_09'], '08')
	})

	test('INPUT 11 response (000024) stores input_assign_24', () => {
		const inst = makeInstance()
		inst.updateData('DTH:000024,01')
		assert.equal(inst.DATA['input_assign_24'], '01')
	})

	test('INPUT 20 response (00002D) stores input_assign_2D', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00002D,0F')
		assert.equal(inst.DATA['input_assign_2D'], '0F')
	})

	test('INPUT 11 response re-resolves pgm_source if it matched slot id 2A', () => {
		const inst = makeInstance()
		inst.DATA['pgm_source'] = '2A'
		inst.updateData('DTH:000024,08')
		assert.equal(inst.DATA['pgm_source'], '08', 'pgm_source should be re-resolved to physical id')
	})

	test('INPUT 20 response re-resolves aux1source if it matched slot id 33', () => {
		const inst = makeInstance()
		inst.DATA['aux1source'] = '33'
		inst.updateData('DTH:00002D,0F')
		assert.equal(inst.DATA['aux1source'], '0F')
	})

	test('address in gap (00000A) does not store any input_assign key', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00000A,01')
		const keys = Object.keys(inst.DATA).filter((k) => k.startsWith('input_assign_'))
		assert.equal(keys.length, 0, 'gap address should not produce input_assign entry')
	})
})

// ---------------------------------------------------------------------------
// CHOICES_INPUTSASSIGN vs CHOICES_DSK_SOURCES boundary validation
// ---------------------------------------------------------------------------

describe('CHOICES_INPUTSASSIGN source range (Input Assign context)', () => {
	test('max id is 32 (0x20 = N/A) — no values above the N/A sentinel', () => {
		const maxId = Math.max(...constants.CHOICES_INPUTSASSIGN.map((c) => c.id))
		assert.equal(maxId, 32, 'Input Assign max id must be 32 (0x20 = N/A)')
	})

	test('id 32 is labelled N/A', () => {
		const entry = constants.CHOICES_INPUTSASSIGN.find((c) => c.id === 32)
		assert.ok(entry, 'entry with id 32 must exist')
		assert.match(entry.label, /n\/a/i, 'entry 32 label must be N/A')
	})

	test('no id exceeds 32', () => {
		const overflows = constants.CHOICES_INPUTSASSIGN.filter((c) => c.id > 32)
		assert.deepEqual(overflows, [], 'CHOICES_INPUTSASSIGN must not contain ids above 0x20')
	})
})

describe('CHOICES_DSK_SOURCES source range (DSK Key/Fill context)', () => {
	test('id 32 maps to INPUT/XPT 1 (0x20)', () => {
		const entry = constants.CHOICES_DSK_SOURCES.find((c) => c.id === 32)
		assert.ok(entry, 'entry with id 32 must exist')
		assert.match(entry.label, /input.*1$/i, 'id 32 must label INPUT/XPT 1')
	})

	test('id 51 maps to INPUT/XPT 20 (0x33)', () => {
		const entry = constants.CHOICES_DSK_SOURCES.find((c) => c.id === 51)
		assert.ok(entry, 'entry with id 51 must exist')
		assert.match(entry.label, /input.*20$/i, 'id 51 must label INPUT/XPT 20')
	})

	test('max id is 51 (0x33)', () => {
		const maxId = Math.max(...constants.CHOICES_DSK_SOURCES.map((c) => c.id))
		assert.equal(maxId, 51, 'DSK sources max id must be 51 (0x33)')
	})
})
