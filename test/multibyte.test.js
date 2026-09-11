'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const api = require('../src/api.js')

function makeInstance() {
	const instance = {
		DATA: {},
		config: { verbose: false },
		log: () => {},
		freezeDataLoaded: false,
		resolveInputSource: (v) => v,
		logVerbose: () => {},
		checkFeedbacks: () => {},
		checkVariables: () => {},
	}
	instance._parseHexBlock = api._parseHexBlock.bind(instance)
	return instance
}

describe('_parseHexBlock', () => {
	test('returns array of uppercased byte strings for valid input', () => {
		const inst = makeInstance()
		const result = inst._parseHexBlock('0304', 2)
		assert.deepEqual(result, ['03', '04'])
	})

	test('returns null when length does not match expectedBytes', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('03', 2), null)
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
		const result = inst._parseHexBlock('abcd', 2)
		assert.deepEqual(result, ['AB', 'CD'])
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

describe('Freeze block parser (updateData integration)', () => {
	function parseFreeze(value) {
		const inst = makeInstance()
		// Simulate the parser branch directly.
		const freezeBlock = inst._parseHexBlock(value, 18)
		if (!freezeBlock) return null
		inst.DATA.freeze = freezeBlock[0]
		inst.DATA.freeze_type = freezeBlock[1]
		for (let i = 2; i < freezeBlock.length; i++) {
			const addrHex = i.toString(16).padStart(2, '0').toUpperCase()
			inst.DATA[`freeze_select_${addrHex}`] = freezeBlock[i]
		}
		inst.freezeDataLoaded = true
		return inst
	}

	test('parses all 18 bytes into correct DATA keys', () => {
		const hex = '010000000101010100010001010101010101'
		const inst = parseFreeze(hex)
		assert.ok(inst !== null)
		assert.equal(inst.DATA.freeze, '01')
		assert.equal(inst.DATA.freeze_type, '00')
		assert.equal(inst.DATA.freeze_select_02, '00')
		assert.equal(inst.DATA.freeze_select_11, '01')
	})

	test('sets freezeDataLoaded to true on successful parse', () => {
		const hex = '000000000101010100010001010101010101'
		const inst = parseFreeze(hex)
		assert.equal(inst.freezeDataLoaded, true)
	})

	test('rejects a value with wrong length (not 36 hex chars)', () => {
		const inst = makeInstance()
		const result = inst._parseHexBlock('0001', 18)
		assert.equal(result, null)
		assert.equal(inst.freezeDataLoaded, false)
	})

	test('rejects a value with non-hex characters', () => {
		const inst = makeInstance()
		const badHex = '00000000010101010001000101010101010Z'
		const result = inst._parseHexBlock(badHex, 18)
		assert.equal(result, null)
	})
})

describe('Multi-byte output assign parser', () => {
	test('parses 6-byte output block into correct keys', () => {
		const inst = makeInstance()
		const outputKeys = ['hdmi1assign', 'hdmi2assign', 'hdmi3assign', 'sdi1assign', 'sdi2assign', 'sdi3assign']
		const outputs = inst._parseHexBlock('000308010405', 6)
		assert.ok(outputs !== null)
		for (let i = 0; i < outputKeys.length; i++) {
			inst.DATA[outputKeys[i]] = outputs[i]
		}
		assert.equal(inst.DATA.hdmi1assign, '00')
		assert.equal(inst.DATA.hdmi2assign, '03')
		assert.equal(inst.DATA.hdmi3assign, '08')
		assert.equal(inst.DATA.sdi1assign, '01')
		assert.equal(inst.DATA.sdi2assign, '04')
		assert.equal(inst.DATA.sdi3assign, '05')
	})

	test('rejects a 5-byte value (wrong length)', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('0003080104', 6), null)
	})
})

describe('Multi-byte PGM+PVW parser', () => {
	test('parses 2-byte block into pgm_source and pvw_source', () => {
		const inst = makeInstance()
		const pgmPvw = inst._parseHexBlock('0002', 2)
		assert.deepEqual(pgmPvw, ['00', '02'])
	})

	test('single-byte value is rejected by _parseHexBlock(value, 2)', () => {
		const inst = makeInstance()
		assert.equal(inst._parseHexBlock('03', 2), null)
	})
})

describe('Multi-byte Aux link parser', () => {
	test('parses 3-byte block into aux1/2/3 link', () => {
		const inst = makeInstance()
		const auxLinks = inst._parseHexBlock('000100', 3)
		assert.deepEqual(auxLinks, ['00', '01', '00'])
	})
})
