'use strict'

const { test, describe, beforeEach } = require('node:test')
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
	// Bind queue methods from api.js onto the stub instance.
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
		await new Promise((r) => setTimeout(r, 50))
		assert.equal(sent.length, 2)
		assert.ok(sent[0].includes('001B00'))
		assert.ok(sent[1].includes('001B01'))
	})

	test('high-priority command is sent before queued low-priority commands', async () => {
		const { instance, sent } = makeInstance()
		// Queue 5 low-priority commands (more than one batch)
		for (let i = 0; i < 5; i++) instance.sendRawCommand(`RQH:00000${i},000001;`)
		// High-priority arrives before the next batch fires
		instance.sendRawCommand('DTH:020500,01;', 'high')
		await new Promise((r) => setTimeout(r, 50))
		assert.equal(sent.length, 6)
		// First batch: 4 low sent immediately via setImmediate, then high jumps next batch
		// High must appear before the 5th low-priority command.
		const hiIdx = sent.findIndex((s) => s.includes('020500'))
		assert.ok(hiIdx < 5, `high-priority sent at index ${hiIdx}, expected before index 5`)
	})

	test('_clearQueue discards all pending commands', async () => {
		const { instance, sent } = makeInstance()
		for (let i = 0; i < 10; i++) instance.sendRawCommand(`RQH:00000${i},000001;`)
		instance._clearQueue()
		await new Promise((r) => setTimeout(r, 50))
		// Only the commands from the first batch (up to 4) may already be sent
		// before _clearQueue fires; none after that.
		assert.ok(sent.length <= 4, `expected ≤4 sent after clear, got ${sent.length}`)
	})

	test('generation counter prevents stale drain after _clearQueue', async () => {
		const { instance, sent } = makeInstance()
		instance.sendRawCommand('RQH:AAAAAA,000001;')
		instance._clearQueue()
		// Fresh commands after clear
		instance.sendRawCommand('RQH:BBBBBB,000001;')
		await new Promise((r) => setTimeout(r, 50))
		// The stale drain (old generation) must not re-send AAAAAA after the clear.
		const stale = sent.filter((s) => s.includes('AAAAAA'))
		assert.equal(stale.length, 0, 'stale drain sent a cleared command')
		assert.ok(sent.some((s) => s.includes('BBBBBB')), 'new command was not sent')
	})

	test('commands are terminated with semicolon and newline', async () => {
		const { instance, sent } = makeInstance()
		instance.sendRawCommand('RQH:001B00,000001')
		await new Promise((r) => setTimeout(r, 20))
		assert.ok(sent[0].endsWith(';\n'), `expected ;\\n terminator, got: ${JSON.stringify(sent[0])}`)
	})
})
