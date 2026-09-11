'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

// Minimal stub that exercises the queue methods from api.js in isolation.
function makeInstance() {
	const sent = []
	const instance = {
		_highQueue: [],
		_lowQueue: [],
		_drainScheduled: false,
		_drainGeneration: 0,
		config: { verbose: false },
		socket: { isConnected: true, send: (cmd) => sent.push(cmd) },
		log: () => {},
	}
	const api = require('../src/api.js')
	instance.sendRawCommand = api.sendRawCommand.bind(instance)
	instance._drainBatch = api._drainBatch.bind(instance)
	instance._clearQueue = api._clearQueue.bind(instance)
	instance._sendDirect = api._sendDirect.bind(instance)
	return { instance, sent }
}

describe('Priority command queue', () => {
	test('low-priority commands are sent in order', async () => {
		const { instance, sent } = makeInstance()
		instance.sendRawCommand('RQH:001B00,000001;')
		instance.sendRawCommand('RQH:001B01,000001;')
		await new Promise((r) => setTimeout(r, 100))
		assert.equal(sent.length, 2)
		assert.ok(sent[0].includes('001B00'))
		assert.ok(sent[1].includes('001B01'))
	})

	test('high-priority command is sent first, before any queued low-priority', async () => {
		const { instance, sent } = makeInstance()
		// Queue 5 low-priority commands synchronously — drain not yet fired.
		for (let i = 0; i < 5; i++) instance.sendRawCommand(`RQH:00000${i},000001;`)
		// High-priority added in the same synchronous tick, before setImmediate fires.
		// When the drain runs it must send the DTH write first.
		instance.sendRawCommand('DTH:020500,01;', 'high')
		await new Promise((r) => setTimeout(r, 200))
		assert.equal(sent.length, 6)
		const hiIdx = sent.findIndex((s) => s.includes('020500'))
		assert.equal(hiIdx, 0, `high-priority should be at index 0, got ${hiIdx}`)
	})

	test('consecutive high-priority commands schedule exactly 20 ms delay between sends', async () => {
		// Spy on global setTimeout to capture the delay value without mocking the
		// full timer system (which would interfere with the test runner itself).
		const { instance, sent } = makeInstance()
		const orig = global.setTimeout
		let capturedDelay = null
		global.setTimeout = (fn, delay) => {
			capturedDelay = delay
			return orig(fn, delay)
		}
		try {
			instance.sendRawCommand('DTH:020500,01;', 'high')
			instance.sendRawCommand('DTH:020500,00;', 'high')
			// Wait for the setImmediate drain: sends first DTH, calls our spy.
			await new Promise((r) => setImmediate(r))
			assert.equal(sent.length, 1, 'first DTH sent immediately')
			assert.equal(capturedDelay, 20, `expected setTimeout delay of 20 ms, got ${capturedDelay}`)
		} finally {
			global.setTimeout = orig
		}
		// Let the real 20 ms timer fire so the instance is fully drained.
		await new Promise((r) => orig(r, 50))
		assert.equal(sent.length, 2, 'second DTH sent after timer fires')
	})

	test('_clearQueue discards all pending commands before first drain', async () => {
		const { instance, sent } = makeInstance()
		for (let i = 0; i < 10; i++) instance.sendRawCommand(`RQH:00000${i},000001;`)
		// _clearQueue called synchronously before the setImmediate drain fires.
		instance._clearQueue()
		await new Promise((r) => setTimeout(r, 50))
		assert.equal(sent.length, 0, `expected 0 sent after clear, got ${sent.length}`)
	})

	test('generation counter prevents stale drain after _clearQueue', async () => {
		const { instance, sent } = makeInstance()
		instance.sendRawCommand('RQH:AAAAAA,000001;')
		instance._clearQueue()
		instance.sendRawCommand('RQH:BBBBBB,000001;')
		await new Promise((r) => setTimeout(r, 50))
		const stale = sent.filter((s) => s.includes('AAAAAA'))
		assert.equal(stale.length, 0, 'stale drain sent a cleared command')
		assert.ok(
			sent.some((s) => s.includes('BBBBBB')),
			'new command was not sent',
		)
	})

	test('commands are terminated with semicolon and newline', async () => {
		const { instance, sent } = makeInstance()
		instance.sendRawCommand('RQH:001B00,000001')
		await new Promise((r) => setTimeout(r, 20))
		assert.ok(sent[0].endsWith(';\n'), `expected ;\\n terminator, got: ${JSON.stringify(sent[0])}`)
	})
})
