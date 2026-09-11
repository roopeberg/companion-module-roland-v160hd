'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const api = require('../src/api.js')

// Minimal instance that satisfies every branch updateData may touch.
function makeInstance() {
	const warnings = []
	const inst = {
		DATA: {},
		config: { verbose: false, password: 'test' },
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
		log: (_level, msg) => {
			if (_level === 'warn') warnings.push(msg)
		},
		logVerbose: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
		checkAllFeedbacks: () => {},
		updateStatus: () => {},
		startInterval: () => {},
		subscribeToTally: () => {},
		sendRawCommand: () => {},
		updateTally: () => {},
		resolveInputSource: (v) => v,
		getAuxData: () => {},
		getNextMemoryName: () => {},
	}
	inst._parseHexBlock = api._parseHexBlock.bind(inst)
	inst._drainBatch = api._drainBatch.bind(inst)
	inst._clearQueue = api._clearQueue.bind(inst)
	inst._sendDirect = api._sendDirect.bind(inst)
	inst.updateData = api.updateData.bind(inst)
	inst._warnings = warnings
	return inst
}

// ---------------------------------------------------------------------------
// _parseHexBlock unit tests
// ---------------------------------------------------------------------------

describe('_parseHexBlock', () => {
	test('returns array of uppercased byte strings for valid input', () => {
		const inst = makeInstance()
		assert.deepEqual(inst._parseHexBlock('0304', 2), ['03', '04'])
	})

	test('returns null when length is shorter than expectedBytes * 2', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('03', 2), null)
	})

	test('returns null when length is longer than expectedBytes * 2', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('030405', 2), null)
	})

	test('returns null for non-hex characters', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('0G', 1), null)
		assert.equal(inst._parseHexBlock('XX', 1), null)
	})

	test('returns null for empty string with expectedBytes > 0', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('', 1), null)
	})

	test('uppercases a-f to A-F', () => {
		const inst = makeInstance()
		assert.deepEqual(inst._parseHexBlock('abcd', 2), ['AB', 'CD'])
	})

	test('handles 18-byte freeze block', () => {
		const inst = makeInstance()
		const hex = '000000000101010100010001010101010101'
		const result = inst._parseHexBlock(hex, 18)
		assert.ok(result !== null)
		assert.equal(result.length, 18)
		assert.equal(result[0], '00')
		assert.equal(result[17], '01')
	})
})

// ---------------------------------------------------------------------------
// Freeze block — via real updateData
// ---------------------------------------------------------------------------

describe('Freeze block (updateData)', () => {
	test('18-byte block populates freeze, freeze_type and all freeze_select keys', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020500,010000000101010100010001010101010101')
		assert.equal(inst.DATA.freeze, '01')
		assert.equal(inst.DATA.freeze_type, '00')
		assert.equal(inst.DATA.freeze_select_02, '00')
		assert.equal(inst.DATA.freeze_select_11, '01')
	})

	test('sets freezeDataLoaded after a valid 18-byte block', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020500,000000000101010100010001010101010101')
		assert.equal(inst.freezeDataLoaded, true)
	})

	test('does NOT set freezeDataLoaded for a wrong-length value', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020500,0001')
		assert.equal(inst.freezeDataLoaded, false)
		assert.equal(inst.DATA.freeze, undefined)
	})

	test('invalid freeze block logs a warning and stores nothing', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020500,0001')
		assert.ok(inst._warnings.some((w) => w.includes('0205') && w.includes('0001')))
		assert.equal(inst.DATA.freeze, undefined)
	})

	test('single-byte freeze state (optimistic update) is accepted', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020500,01')
		assert.equal(inst.DATA.freeze, '01')
		assert.equal(inst.freezeDataLoaded, false)
	})

	test('non-hex characters in freeze value are rejected', () => {
		const inst = makeInstance()
		const badHex = '00000000010101010001000101010101010Z'
		inst.updateData(`DTH:020500,${badHex}`)
		assert.equal(inst.DATA.freeze, undefined)
	})
})

// ---------------------------------------------------------------------------
// PGM+PVW block — via real updateData
// ---------------------------------------------------------------------------

describe('PGM+PVW block (updateData)', () => {
	test('2-byte block populates both pgm_source and pvw_source', () => {
		const inst = makeInstance()
		inst.updateData('DTH:002100,0302')
		assert.equal(inst.DATA.pgm_source, '03')
		assert.equal(inst.DATA.pvw_source, '02')
	})

	test('single-byte value sets only pgm_source', () => {
		const inst = makeInstance()
		inst.updateData('DTH:002100,03')
		assert.equal(inst.DATA.pgm_source, '03')
		assert.equal(inst.DATA.pvw_source, undefined)
	})

	test('invalid value (wrong length) is rejected with a warning', () => {
		const inst = makeInstance()
		inst.updateData('DTH:002100,01F')
		assert.ok(inst._warnings.some((w) => w.includes('002100')))
		assert.equal(inst.DATA.pgm_source, undefined)
	})
})

// ---------------------------------------------------------------------------
// Aux 2+3 source block — via real updateData
// ---------------------------------------------------------------------------

describe('Aux 2+3 source block (updateData)', () => {
	test('2-byte block populates aux2source and aux3source', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00002E,0304')
		assert.equal(inst.DATA.aux2source, '03')
		assert.equal(inst.DATA.aux3source, '04')
	})

	test('invalid value (3 hex chars, not 2 or 4) is rejected with a warning', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00002E,01F')
		assert.ok(inst._warnings.some((w) => w.includes('00002E')))
		assert.equal(inst.DATA.aux2source, undefined)
	})
})

// ---------------------------------------------------------------------------
// Output assign block — via real updateData
// ---------------------------------------------------------------------------

describe('Output assign block (updateData)', () => {
	test('6-byte block populates all six output keys', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00000A,000308010405')
		assert.equal(inst.DATA.hdmi1assign, '00')
		assert.equal(inst.DATA.hdmi2assign, '03')
		assert.equal(inst.DATA.hdmi3assign, '08')
		assert.equal(inst.DATA.sdi1assign, '01')
		assert.equal(inst.DATA.sdi2assign, '04')
		assert.equal(inst.DATA.sdi3assign, '05')
	})

	test('invalid value (4 hex chars instead of 12) is rejected', () => {
		const inst = makeInstance()
		inst.updateData('DTH:00000A,0001')
		assert.ok(inst._warnings.some((w) => w.includes('00000A')))
		assert.equal(inst.DATA.hdmi1assign, undefined)
	})
})

// ---------------------------------------------------------------------------
// Aux link block — via real updateData
// ---------------------------------------------------------------------------

describe('Aux link block (updateData)', () => {
	test('3-byte block populates aux1link, aux2link, aux3link', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020154,000100')
		assert.equal(inst.DATA.aux1link, '00')
		assert.equal(inst.DATA.aux2link, '01')
		assert.equal(inst.DATA.aux3link, '00')
	})

	test('invalid value (4 hex chars instead of 6) is rejected', () => {
		const inst = makeInstance()
		inst.updateData('DTH:020154,0100')
		assert.ok(inst._warnings.some((w) => w.includes('020154')))
		assert.equal(inst.DATA.aux1link, undefined)
	})
})
