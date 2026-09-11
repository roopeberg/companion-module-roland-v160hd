const { InstanceStatus, TCPHelper } = require('@companion-module/base')
const { extractMessages } = require('./tcpParser')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SNAPSHOT_DIR = path.join(os.homedir(), 'v160hd-snapshots')

// Exact DATA keys that belong to PiP / DSK capture (set by capturePinp / captureDsk).
// Only these are persisted to and restored from snapshot files so that live state
// (PiP on-air, PGM/PVW source, AUX, mute, outputs …) is never overwritten.
const PIP_PREFIXES = ['1B', '1C', '1D', '1E']
const PIP_SUFFIXES = new Set(['00', '01', '02', '03', '04', '06', '08', '0A', '0C', '0E', '0F', '10', '11', '13', '15'])
const DSK_PREFIXES = ['1F', '20']
const DSK_SUFFIXES = new Set(['00', '01', '02', '03', '04', '05', '06', '07', '09'])
function isCaptureKey(k) {
	if (!k.startsWith('data_') || k.length !== 9) return false
	const prefix = k.slice(5, 7)
	const suffix = k.slice(7, 9)
	if (PIP_PREFIXES.includes(prefix)) return PIP_SUFFIXES.has(suffix)
	if (DSK_PREFIXES.includes(prefix)) return DSK_SUFFIXES.has(suffix)
	return false
}

module.exports = {
	initConnection: function () {
		let self = this

		// Stop polling before tearing down the socket so no commands are sent
		// to a dead or not-yet-authenticated connection.
		if (self.INTERVAL !== undefined) {
			clearInterval(self.INTERVAL)
			self.INTERVAL = undefined
		}

		// Discard any queued commands from the old connection so they don't
		// arrive on a new socket after reconnect.
		self._clearQueue()

		if (self.socket !== undefined) {
			self.socket.destroy()
			delete self.socket
		}

		self.tcpBuffer = ''

		if (self.config.port === undefined) {
			self.config.port = 8023
		}

		if (self.config.host) {
			self.log('info', `Opening connection to ${self.config.host}:${self.config.port}`)
			self.updateStatus(InstanceStatus.Connecting, 'Connecting')

			// Capture the socket in a local const so late-firing events from a
			// destroyed socket cannot affect a newer socket assigned to self.socket.
			const socket = new TCPHelper(self.config.host, self.config.port, {
				reconnect: true,
				reconnect_interval: 30000,
			})
			self.socket = socket

			socket.on('error', function (err) {
				if (socket !== self.socket) return
				if (self.config.verbose) {
					self.log('warn', 'Error: ' + err)
				}

				clearInterval(self.INTERVAL)
				self.INTERVAL = undefined
				self.handleError(err)
			})

			socket.on('connect', function () {
				if (socket !== self.socket) return
				self.log('info', 'Connected — waiting for auth prompt')
				self.tcpBuffer = ''
				self.memoryNameIndex = 0
				self.updateStatus(InstanceStatus.Connecting, 'Authenticating')
			})

			socket.on('end', function () {
				if (socket !== self.socket) return
				self.log('warn', 'Connection closed by device — TCPHelper will reconnect in 30 s')
				clearInterval(self.INTERVAL)
				self.INTERVAL = undefined
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Closed')
			})

			self.tcpBuffer = ''

			socket.on('data', function (buffer) {
				if (socket !== self.socket) return
				self.tcpBuffer += buffer.toString('utf8')
				const { messages, remaining } = extractMessages(self.tcpBuffer)
				self.tcpBuffer = remaining
				for (const msg of messages) {
					self.updateData(msg)
				}
			})
		}
	},

	handleError: function (err) {
		let self = this

		try {
			let error = err.toString()
			let printedError = false

			Object.keys(err).forEach(function (key) {
				if (key === 'code') {
					if (err[key] === 'ECONNREFUSED') {
						error =
							'Unable to communicate with Device. Connection refused. Is this the right IP address? Is it still online?'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Refused')
						printedError = true
					} else if (err[key] === 'ETIMEDOUT') {
						error =
							'Unable to communicate with Device. Connection timed out. Is this the right IP address? Is it still online?'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Timed Out')
						printedError = true
					} else if (err[key] === 'ECONNRESET') {
						error = 'The connection was reset. Check the log for more error information.'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Reset')
						printedError = true
					}
				}
			})

			if (!printedError) {
				self.log('error', `Network error: ${error}`)
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Network Error')
			}
		} catch (error) {
			self.log('error', 'Error handling error: ' + error)
			self.log('error', 'Error: ' + String(err))
		}
	},

	startInterval: function () {
		let self = this

		if (self.INTERVAL !== undefined) {
			clearInterval(self.INTERVAL)
			self.INTERVAL = undefined
		}

		if (!self.config.polling) {
			self.log('info', 'Polling is disabled. Module will not request new data at a regular rate.')
			return
		}

		const MIN_RATE = 300
		const MAX_RATE = 30000
		const DEFAULT_RATE = 500
		const raw = String(self.config.pollingrate ?? '').trim()
		const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN
		const rate = Number.isFinite(parsed) ? Math.min(MAX_RATE, Math.max(MIN_RATE, parsed)) : DEFAULT_RATE
		if (raw !== '' && rate !== parsed) {
			self.log('warn', `Polling rate clamped to ${rate} ms (was '${self.config.pollingrate}')`)
		}
		self.log('info', `Starting polling: fast=${rate}ms, medium=${rate * 2}ms, background=${rate * 10}ms`)

		self._pollTick = 0
		// Fire all tiers immediately so Companion has full state before the first scheduled tick.
		self._doPoll(true)
		self.INTERVAL = setInterval(() => self._doPoll(false), rate)
	},

	// Multi-speed poll tick.
	//   Fast (every tick):      PiP tally + bus sources     — reflects live switch-panel changes
	//   Medium (every 2 ticks): AUX mutes + one memory name — changes only on user action
	//   Background (every 10):  PiP sources, freeze, outputs, AUX links, transition — rarely change
	// immediate=true fires all tiers at once (used on connect/reconnect).
	_doPoll: function (immediate) {
		let self = this
		self._pollTick = (self._pollTick || 0) + 1

		// Fast
		self.getPinpKeyTally()
		self.getAuxSources()

		// Medium (~1 s at default rate)
		if (immediate || self._pollTick % 2 === 0) {
			self.getAuxMutes()
			self.getNextMemoryName()
		}

		// Background (~5 s at default rate)
		if (immediate || self._pollTick % 10 === 0) {
			self.getPinpKeySource()
			self.getFreezeData()
			self.getOutputData()
			self.getAuxLinkData()
			self.getTransitionData()
		}
	},

	getPinpKeyTally: function () {
		let self = this

		// PGM+PVW tally for each PiP/Key — xx00 and xx01 are consecutive (2 bytes each).
		self.sendRawCommand('RQH:001B00,000002;') //PnP/Key 1 PGM+PVW tally
		self.sendRawCommand('RQH:001C00,000002;') //PnP/Key 2 PGM+PVW tally
		self.sendRawCommand('RQH:001D00,000002;') //PnP/Key 3 PGM+PVW tally
		self.sendRawCommand('RQH:001E00,000002;') //PnP/Key 4 PGM+PVW tally
	},

	getPinpKeySource: function () {
		let self = this

		self.sendRawCommand('RQH:001B02,000001;') //PnP/Key 1 source
		self.sendRawCommand('RQH:001C02,000001;') //PnP/Key 2 source
		self.sendRawCommand('RQH:001D02,000001;') //PnP/Key 3 source
		self.sendRawCommand('RQH:001E02,000001;') //PnP/Key 4 source
	},

	refreshPipSourceData: function () {
		this.getPinpKeySource()
	},

	getAuxSources: function () {
		let self = this

		// Debounce: tally-triggered re-polls and action-triggered re-polls can
		// arrive within milliseconds of each other. Skip if queried within 250 ms.
		const now = Date.now()
		if (now - (self._lastAuxSourceQuery || 0) < 250) return
		self._lastAuxSourceQuery = now

		// PGM + PVW are consecutive: 002100–002101 (2 bytes).
		self.sendRawCommand('RQH:002100,000002;')
		self.sendRawCommand('RQH:000011,000001;') //Aux 1 current source (not contiguous with others)
		// Aux 2 + Aux 3 source are consecutive: 00002E–00002F (2 bytes).
		self.sendRawCommand('RQH:00002E,000002;')
	},

	getAuxMutes: function () {
		let self = this

		self.sendRawCommand('RQH:012203,000001;') //Aux 1 mute
		self.sendRawCommand('RQH:012503,000001;') //Aux 2 mute
		self.sendRawCommand('RQH:012603,000001;') //Aux 3 mute
	},

	getAuxData: function () {
		let self = this
		self.getAuxSources()
		self.getAuxMutes()
	},

	getFreezeData: function () {
		let self = this

		// Read all 18 freeze bytes in one query: 020500 (freeze on/off) through
		// 020511 (SDI IN 8 select) = 0x12 consecutive bytes.
		// freezeDataLoaded is set to true only after the block response is parsed.
		self.sendRawCommand('RQH:020500,000012;')
	},

	refreshFreezeData: function () {
		this.getFreezeData()
	},

	getOutputData: function () {
		let self = this

		// HDMI 1-3 + SDI 1-3 are consecutive: 00000A–00000F (6 bytes).
		self.sendRawCommand('RQH:00000A,000006;')
	},

	getTransitionData: function () {
		let self = this

		// Transition type, mix type, wipe type, wipe direction are consecutive:
		// 001800–001803 (4 bytes) — read in one multi-byte query.
		// transitionDataLoaded is set to true after the block response is parsed.
		self.sendRawCommand('RQH:001800,000004;')
	},

	getAuxLinkData: function () {
		let self = this

		self.sendRawCommand('RQH:02010D,000001;') //Aux Link Mode Off/Auto/Manual (not contiguous)
		// Aux 1-3 link on/off are consecutive: 020154–020156 (3 bytes).
		self.sendRawCommand('RQH:020154,000003;')
	},

	getInputAssignData: function () {
		let self = this

		for (let i = 0; i < 10; i++) {
			const hex = i.toString(16).padStart(2, '0').toUpperCase()
			self.sendRawCommand(`RQH:0000${hex},000001;`)
		}
	},

	// Resolves an INPUT slot ID (20–29) to the physical source ID stored in
	// DATA.input_assign_NN. If not yet cached, fires a targeted RQH so the
	// assignment arrives shortly and triggers a re-resolve via the handler above.
	resolveInputSource: function (id) {
		let self = this
		const val = parseInt(id, 16)
		if (val >= 0x20 && val <= 0x29) {
			const slotHex = (val - 0x20).toString(16).padStart(2, '0').toUpperCase()
			const physical = self.DATA[`input_assign_${slotHex}`]
			if (physical !== undefined) return physical
			// Not cached yet — request it; response will re-resolve the bus source
			self.sendRawCommand(`RQH:0000${slotHex},000001;`)
		}
		return id
	},

	/*getTallyData: function() {
		let self = this;

		for (let i = 0; i < 16; i++) {
			let hex = i.toString(16).padStart(2, '0').toUpperCase();
			let command = '0C' + '00' + hex + ',000001;';

			self.sendRawCommand('RQH:' + command);
		}
	},*/

	// Requests one memory slot's name per medium poll tick (one 8-byte RQH block).
	// Cycles through slots 0–29 continuously at ~1 s per slot = 30 s full refresh.
	getNextMemoryName: function () {
		let self = this

		if (self.memoryNameIndex === undefined) {
			self.memoryNameIndex = 0
		}
		const i = self.memoryNameIndex
		const hexMemory = i.toString(16).padStart(2, '0').toUpperCase()
		// Read all 8 name characters for this slot in one query (60xx00–60xx07).
		self.sendRawCommand('RQH:60' + hexMemory + '00,000008;')
		self.memoryNameIndex = (i + 1) % 30
	},

	refreshMemoryNames: function () {
		// Reset the cycle index so a recently renamed slot is picked up within one cycle.
		this.memoryNameIndex = 0
	},

	getLastMemoryLoaded: function () {
		let self = this

		self.sendRawCommand('RQH:0A0003,000001;')
	},

	subscribeToTally: function () {
		let self = this

		self.sendRawCommand('DTH:0C0100,01;') //TALLY SEND ACTIVE
	},

	updateData: function (data) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', data)
		}

		if (data.trim() == 'Enter password:') {
			self.updateStatus(InstanceStatus.Connecting, 'Authenticating')
			self.log('info', 'Sending passcode')
			self.socket.send(self.config.password + '\n')
		} else if (data.trim() == 'Welcome to V-160HD.') {
			self.updateStatus(InstanceStatus.Ok)
			self.log('info', 'Authenticated.')
			self.memoryNameIndex = 0
			self.sendRawCommand('VER') //request version info
			self.startInterval() //request some states
			self.subscribeToTally() //request tally changes
		} else if (data.trim() == 'ERR:0') {
			//an error with something that it received
		} else {
			//do stuff with the data
			try {
				const msg = data.trim()
				if (msg !== 'ACK' && msg !== '') {
					let dataSet = msg.split(':')
					let dataPrefix = dataSet[0] !== undefined ? dataSet[0].toString().trim() : ''
					let dataSuffix = ''

					if (dataSet.length > 1) {
						if (dataSet[1].toString().includes(',')) {
							dataSuffix = dataSet[1].toString().split(',')

							if (dataPrefix.indexOf('VER') > -1) {
								self.MODEL = dataSuffix[0].toString()
								self.VERSION = dataSuffix[1].toString()
							}

							if (dataPrefix.indexOf('DTH') > -1) {
								if (dataSuffix[0].length === 6) {
									let params = dataSuffix[0]
									let param1 = params[0] + params[1]
									let param2 = params[2] + params[3]
									let param3 = params[4] + params[5]

									let value = dataSuffix[1]

									/*if (param1 == '0C' && param2 == '00') { //tally message
													self.updateTally(param3, value);
												}*/

									if (param1 == '0C' && param2 == '00' && param3 == '00') {
										//subscribe tally message — device pushes this on every source change
										self.logVerbose('Received Subscribe Tally Message')
										let index = 0
										const halfLength = value.length / 2
										for (let t = 0; t < halfLength; t++) {
											const input = t.toString(16).padStart(2, '0').toUpperCase()
											const tallyState = value[index] + value[index + 1]
											self.updateTally(input, tallyState)
											index = index + 2
										}
										// Re-poll bus sources immediately so DATA.pgm_source etc. reflect
										// the hardware-panel change within one TCP round-trip.
										// Mutes do not change on source switches — skip getAuxMutes here.
										self.getAuxSources()
									}

									if (param1 == '00') {
										if (param2 == '00' && parseInt(param3, 16) <= 9) {
											//INPUT slot assignment (000000–000009) — re-resolve any bus source pending on this slot
											self.logVerbose(`Received Input ${parseInt(param3, 16) + 1} Assign: ${value}`)
											self.DATA[`input_assign_${param3}`] = value
											const inputId = (parseInt(param3, 16) + 0x20).toString(16).padStart(2, '0').toUpperCase()
											const busSources = ['pgm_source', 'pvw_source', 'aux1source', 'aux2source', 'aux3source']
											for (const key of busSources) {
												if (self.DATA[key] === inputId) {
													self.DATA[key] = value
													self.logVerbose(`Re-resolved ${key}: ${inputId} → ${value}`)
												}
											}
										} else if (param2 == '21' && param3 == '00') {
											const pgmPvw = self._parseHexBlock(value, 2)
											if (pgmPvw) {
												// Multi-byte: RQH:002100,000002 — PGM+PVW in one shot.
												self.DATA.pgm_source = self.resolveInputSource(pgmPvw[0])
												self.DATA.pvw_source = self.resolveInputSource(pgmPvw[1])
												self.logVerbose('Received PGM+PVW block: ' + value)
											} else if (self._parseHexBlock(value, 1)) {
												self.DATA.pgm_source = self.resolveInputSource(value)
												self.logVerbose('Received PGM Source: ' + value)
											} else {
												self.log('warn', `DTH:002100 — unexpected value "${value}", ignored`)
											}
										} else if (param2 == '21' && param3 == '01') {
											//PVW source (single-byte path only — multi-byte handled at param3 '00')
											self.logVerbose('Received PVW Source: ' + value)
											self.DATA.pvw_source = self.resolveInputSource(value)
										} else if (param2 == '00' && param3 == '11') {
											//aux 1 source
											self.logVerbose('Received Aux 1 Source: ' + value)
											self.DATA.aux1source = self.resolveInputSource(value)
										} else if (param2 == '00' && param3 == '2E') {
											const aux23 = self._parseHexBlock(value, 2)
											if (aux23) {
												// Multi-byte: RQH:00002E,000002 — Aux 2+3 source in one shot.
												self.DATA.aux2source = self.resolveInputSource(aux23[0])
												self.DATA.aux3source = self.resolveInputSource(aux23[1])
												self.logVerbose('Received Aux 2+3 Source block: ' + value)
											} else if (self._parseHexBlock(value, 1)) {
												self.DATA.aux2source = self.resolveInputSource(value)
												self.logVerbose('Received Aux 2 Source: ' + value)
											} else {
												self.log('warn', `DTH:00002E — unexpected value "${value}", ignored`)
											}
										} else if (param2 == '00' && param3 == '2F') {
											//aux 3 source (single-byte path only — multi-byte handled at param3 '2E')
											self.logVerbose('Received Aux 3 Source: ' + value)
											self.DATA.aux3source = self.resolveInputSource(value)
										} else if (param2 == '1B' && param3 == '02') {
											//pnp key 1 source
											let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
												return item.id == value
											})
											self.DATA.pnpkey1source = value
											self.logVerbose('Received PnP/Key 1 Source: ' + value)
											if (lookup) {
												self.DATA.pnpkey1sourcename = lookup.label
												self.logVerbose('PnP/Key 1 Source Name: ' + lookup.label)
											}
										} else if (param2 == '1C' && param3 == '02') {
											//pnp key 2 source
											let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
												return item.id == value
											})
											self.DATA.pnpkey2source = value
											self.logVerbose('Received PnP/Key 2 Source: ' + value)
											if (lookup) {
												self.DATA.pnpkey2sourcename = lookup.label
												self.logVerbose('PnP/Key 2 Source Name: ' + lookup.label)
											}
										} else if (param2 == '1D' && param3 == '02') {
											//pnp key 3 source
											let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
												return item.id == value
											})
											self.DATA.pnpkey3source = value
											self.logVerbose('Received PnP/Key 3 Source: ' + value)
											if (lookup) {
												self.DATA.pnpkey3sourcename = lookup.label
												self.logVerbose('PnP/Key 3 Source Name: ' + lookup.label)
											}
										} else if (param2 == '1E' && param3 == '02') {
											//pnp key 4 source
											let lookup = self.CHOICES_PNPKEY_SOURCES.find((item) => {
												return item.id == value
											})
											self.DATA.pnpkey4source = value
											self.logVerbose('Received PnP/Key 4 Source: ' + value)
											if (lookup) {
												self.DATA.pnpkey4sourcename = lookup.label
												self.logVerbose('PnP/Key 4 Source Name: ' + lookup.label)
											}
										} else if (
											['1B', '1C', '1D', '1E'].includes(param2) &&
											param3 == '00'
										) {
											// PiP/Key PGM+PVW tally pair — xx00 (PGM) and xx01 (PVW).
											const tallies = self._parseHexBlock(value, 2)
											if (tallies) {
												self.DATA[`data_${param2}00`] = tallies[0]
												self.DATA[`data_${param2}01`] = tallies[1]
												self.logVerbose(`Received PiP ${param2} tally block: ${value}`)
											} else if (self._parseHexBlock(value, 1)) {
												self.DATA[`data_${param2}00`] = value
												self.logVerbose(`Received PiP ${param2} PGM tally: ${value}`)
											} else {
												self.log('warn', `DTH:00${param2}00 — unexpected value "${value}", ignored`)
											}
										} else {
											//other data
											self.DATA[`data_${param2}${param3}`] = value
										}
									}

									if (param1 == '02' && param2 == '05') {
										const freezeBlock = param3 === '00' ? self._parseHexBlock(value, 18) : null
										if (freezeBlock) {
											// Multi-byte response from RQH:020500,000012 — parse all 18 bytes at once.
											self.DATA.freeze = freezeBlock[0]
											self.DATA.freeze_type = freezeBlock[1]
											for (let i = 2; i < freezeBlock.length; i++) {
												const addrHex = i.toString(16).padStart(2, '0').toUpperCase()
												self.DATA[`freeze_select_${addrHex}`] = freezeBlock[i]
											}
											self.freezeDataLoaded = true
											self.logVerbose('Received freeze block: ' + value)
										} else if (self._parseHexBlock(value, 1)) {
											// Single-byte response — optimistic update from an action.
											const p3 = parseInt(param3, 16)
											if (param3 == '00') {
												self.DATA.freeze = value
												self.logVerbose('Received Freeze State: ' + value)
											} else if (param3 == '01') {
												self.DATA.freeze_type = value
												self.logVerbose('Received Freeze Type: ' + value)
											} else if (p3 >= 2 && p3 <= 0x11) {
												self.DATA[`freeze_select_${param3}`] = value
												self.logVerbose(`Received Freeze Select ${param3}: ${value}`)
											}
										} else {
											self.log('warn', `DTH:0205${param3} — unexpected value "${value}", ignored`)
										}
									}

									if (param1 == '01' && param2 == '22' && param3 == '03') {
										//aux 1 mute
										self.DATA.aux1mute = value
										self.logVerbose('Received Aux 1 Mute: ' + value)
									}

									if (param1 == '01' && param2 == '25' && param3 == '03') {
										//aux 2 mute
										self.DATA.aux2mute = value
										self.logVerbose('Received Aux 2 Mute: ' + value)
									}

									if (param1 == '01' && param2 == '26' && param3 == '03') {
										//aux 3 mute
										self.DATA.aux3mute = value
										self.logVerbose('Received Aux 3 Mute: ' + value)
									}

									if (param1 == '00' && param2 == '18') {
										// Transition settings: 001800–001803 (type, mix, wipe, direction).
										const transKeys = ['transition_type', 'mix_type', 'wipe_type', 'wipe_direction']
										if (param3 === '00') {
											const block = self._parseHexBlock(value, 4)
											if (block) {
												// Multi-byte: RQH:001800,000004 — all 4 settings in one shot.
												for (let i = 0; i < transKeys.length; i++) {
													self.DATA[transKeys[i]] = parseInt(block[i], 16)
												}
												self.transitionDataLoaded = true
												self.logVerbose('Received transition block: ' + value)
											} else if (self._parseHexBlock(value, 1)) {
												self.DATA.transition_type = parseInt(value, 16)
												self.logVerbose('Received Transition Type: ' + value)
											} else {
												self.log('warn', `DTH:001800 — unexpected value "${value}", ignored`)
											}
										} else if (param3 === '01') {
											self.DATA.mix_type = parseInt(value, 16)
											self.logVerbose('Received Mix Type: ' + value)
										} else if (param3 === '02') {
											self.DATA.wipe_type = parseInt(value, 16)
											self.logVerbose('Received Wipe Type: ' + value)
										} else if (param3 === '03') {
											self.DATA.wipe_direction = parseInt(value, 16)
											self.logVerbose('Received Wipe Direction: ' + value)
										}
									}

									if (param1 == '00' && param2 == '00' && param3 == '0A') {
										const outputKeys = [
											'hdmi1assign',
											'hdmi2assign',
											'hdmi3assign',
											'sdi1assign',
											'sdi2assign',
											'sdi3assign',
										]
										const outputs = self._parseHexBlock(value, outputKeys.length)
										if (outputs) {
											// Multi-byte: RQH:00000A,000006 — HDMI 1-3 + SDI 1-3 in one shot.
											for (let i = 0; i < outputKeys.length; i++) {
												self.DATA[outputKeys[i]] = outputs[i]
											}
											self.logVerbose('Received output assign block: ' + value)
										} else if (self._parseHexBlock(value, 1)) {
											self.DATA.hdmi1assign = value
											self.logVerbose('Received HDMI 1 Output Assign: ' + value)
										} else {
											self.log('warn', `DTH:00000A — unexpected value "${value}", ignored`)
										}
									}

									if (param1 == '00' && param2 == '00' && param3 == '0B') {
										self.DATA.hdmi2assign = value
										self.logVerbose('Received HDMI 2 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0C') {
										self.DATA.hdmi3assign = value
										self.logVerbose('Received HDMI 3 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0D') {
										self.DATA.sdi1assign = value
										self.logVerbose('Received SDI 1 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0E') {
										self.DATA.sdi2assign = value
										self.logVerbose('Received SDI 2 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0F') {
										self.DATA.sdi3assign = value
										self.logVerbose('Received SDI 3 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '01' && param3 == '10') {
										//usb output assign
										self.DATA.usbassign = value
										self.logVerbose('Received USB Output Assign: ' + value)
									}

									if (param1 == '02' && param2 == '01' && param3 == '0D') {
										//aux link mode
										self.DATA.auxlinkmode = value
										self.logVerbose('Received Aux Link Mode: ' + value)
									}

									if (param1 == '02' && param2 == '01' && param3 == '54') {
										const auxLinks = self._parseHexBlock(value, 3)
										if (auxLinks) {
											// Multi-byte: RQH:020154,000003 — Aux 1-3 link in one shot.
											self.DATA.aux1link = auxLinks[0]
											self.DATA.aux2link = auxLinks[1]
											self.DATA.aux3link = auxLinks[2]
											self.logVerbose('Received Aux link block: ' + value)
										} else if (self._parseHexBlock(value, 1)) {
											self.DATA.aux1link = value
											self.logVerbose('Received Aux 1 Link: ' + value)
										} else {
											self.log('warn', `DTH:020154 — unexpected value "${value}", ignored`)
										}
									}

									if (param1 == '02' && param2 == '01' && param3 == '55') {
										self.DATA.aux2link = value
										self.logVerbose('Received Aux 2 Link: ' + value)
									}

									if (param1 == '02' && param2 == '01' && param3 == '56') {
										self.DATA.aux3link = value
										self.logVerbose('Received Aux 3 Link: ' + value)
									}

									if (param1 == '60') {
										const memoryNumber = parseInt(param2, 16)
										const nameBlock = param3 === '00' ? self._parseHexBlock(value, 8) : null
										if (nameBlock) {
											// Multi-byte: RQH:60xx00,000008 — all 8 name chars in one shot.
											const memoryName = nameBlock.map((b) => String.fromCharCode(parseInt(b, 16))).join('')
											self.DATA[`memory${memoryNumber}`] = memoryName
											const displayName = memoryName.replace(/\0/g, '').trimEnd()
											self.setVariableValues({ [`memoryname_${memoryNumber + 1}`]: displayName })
											self.logVerbose(`Received memory ${memoryNumber + 1} name block: "${displayName}"`)
										} else if (self._parseHexBlock(value, 1)) {
											// Single-byte: individual char (legacy path, kept for safety).
											const memoryCharIndex = parseInt(param3, 16)
											const char = String.fromCharCode(parseInt(value, 16))
											let memoryName = self.DATA[`memory${memoryNumber}`] || '        '
											if (memoryName.length < 8) memoryName = memoryName.padEnd(8, ' ')
											memoryName =
												memoryName.substring(0, memoryCharIndex) +
												char +
												memoryName.substring(memoryCharIndex + 1)
											self.DATA[`memory${memoryNumber}`] = memoryName
											self.setVariableValues({ [`memoryname_${memoryNumber + 1}`]: memoryName.trimEnd() })
										} else {
											self.log('warn', `DTH:60${param2}${param3} — unexpected value "${value}", ignored`)
										}
									}

									if (param1 == '0A') {
										//memory functions
										if (param2 == '00' && param3 == '03') {
											//last memory loaded
											self.DATA.lastMemory = parseInt(value, 16)

											//get the memory name based on the last memory loaded
											let memoryName = self.DATA[`memory${self.DATA.lastMemory}`]

											//update variables
											let variableObj = {}
											variableObj['lastmemorynumber'] = self.DATA.lastMemory
											variableObj['lastmemoryname'] = memoryName ? memoryName.trimEnd() : ''
											self.setVariableValues(variableObj)
										}
									}
								}
							}
						}
					}
				}

				//now update feedbacks and variables
				self.checkAllFeedbacks()
				self.checkVariables()
			} catch (error) {
				self.log('error', 'Error parsing incoming data: ' + error)
				self.log('error', 'Data: ' + data)
			}
		}
	},

	updateTally: function (input, value) {
		let self = this

		let tallyId = parseInt(input, 16)
		let tallyValue = parseInt(value, 16)

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			if (self.TALLYDATA[i].id == tallyId) {
				self.TALLYDATA[i].status = tallyValue
				self.TALLYDATA[i].pgm = (tallyValue & 0x01) !== 0
				self.TALLYDATA[i].pvw = (tallyValue & 0x02) !== 0
			}
		}
	},

	sendCommand: function (address, value) {
		let self = this

		let cmd = 'DTH:' + address + ',' + value + ';'
		self.logVerbose('Sending command: ' + cmd)
		self.sendRawCommand(cmd, 'high')
	},

	requestData: function (command) {
		let self = this

		let cmd = 'RQH:' + command + ';'
		self.sendRawCommand(cmd)
	},

	// Enqueue a command. High-priority writes are sent before pending low-priority requests.
	sendRawCommand: function (command, priority = 'low') {
		let self = this

		let cmd = String(command).replace(/[\r\n]+$/g, '')
		if (!cmd.endsWith(';')) {
			cmd += ';'
		}

		if (priority === 'high') {
			self._highQueue.push(cmd)
		} else {
			self._lowQueue.push(cmd)
		}

		if (!self._drainScheduled) {
			self._drainScheduled = true
			// First drain fires immediately so user commands feel instant;
			// subsequent batches use a real delay to avoid device overload.
			const gen = self._drainGeneration
			setImmediate(() => self._drainBatch(gen))
		}
	},

	_drainBatch: function (gen) {
		let self = this

		// Stale callback from before a _clearQueue call — discard silently.
		if (gen !== self._drainGeneration) return

		self._drainScheduled = false

		if (self._highQueue.length > 0) {
			// DTH writes: ≥20 ms between sends to stay within the device's Data Set
			// rate limit. Enforce wall-clock gap even when the queue was empty between
			// two consecutive high-priority commands (so setImmediate doesn't bypass it).
			const elapsed = Date.now() - (self._lastHighSentAt || 0)
			if (elapsed < 20) {
				self._drainScheduled = true
				const nextGen = self._drainGeneration
				setTimeout(() => self._drainBatch(nextGen), 20 - elapsed)
				return
			}
			self._lastHighSentAt = Date.now()
			self._sendDirect(self._highQueue.shift())
			if (self._highQueue.length > 0 || self._lowQueue.length > 0) {
				self._drainScheduled = true
				const nextGen = self._drainGeneration
				setTimeout(() => self._drainBatch(nextGen), 20)
			}
			return
		}

		// No writes pending: send a batch of low-priority RQH reads.
		const BATCH_LOW = 4
		for (let i = 0; i < BATCH_LOW && self._lowQueue.length > 0; i++) {
			self._sendDirect(self._lowQueue.shift())
		}

		if (self._lowQueue.length > 0) {
			self._drainScheduled = true
			const nextGen = self._drainGeneration
			setTimeout(() => self._drainBatch(nextGen), 5)
		}
	},

	_clearQueue: function () {
		let self = this
		self._highQueue = []
		self._lowQueue = []
		self._drainScheduled = false
		// Increment generation so any already-scheduled setImmediate/setTimeout
		// callback sees a stale generation and exits without touching the new queues.
		self._drainGeneration = (self._drainGeneration || 0) + 1
	},

	_sendDirect: function (cmd) {
		let self = this
		const raw = cmd + '\n'

		if (self.socket !== undefined && self.socket.isConnected) {
			if (self.config.verbose) {
				self.log('debug', 'Sending: ' + raw)
			}
			self.socket.send(raw)
		} else {
			if (self.config.verbose) {
				self.log('warn', 'Unable to send: Socket not connected.')
			}
		}
	},

	logVerbose: function (message) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', message)
		}
	},

	// Parse a multi-byte hex block from a DTH response value.
	// Returns an array of two-char uppercase hex strings (one per byte) when
	// value is exactly expectedBytes * 2 hex characters, null otherwise.
	_parseHexBlock: function (value, expectedBytes) {
		if (value.length !== expectedBytes * 2) return null
		if (!/^[0-9A-Fa-f]+$/.test(value)) return null
		const out = []
		for (let i = 0; i < expectedBytes; i++) {
			out.push(value.slice(i * 2, i * 2 + 2).toUpperCase())
		}
		return out
	},

	calculateBytes: function (value, scale = 10) {
		/*
		From Roland:
		Due to MIDI protocol restrictions, 8-bit data must be separated into 7-bit sections.
		The MIDI protocol uses the MSB bit to identify such messages as Note on messages.
		Two 7-bit byte data contains 14-bit data.
		Then mask the data with a 14-bit pattern.
		*/

		const scaled = Math.round(value * scale) & 0x3fff
		const lsb = scaled & 0x7f
		const msb = (scaled >> 7) & 0x7f
		return [msb, lsb]
	},

	formatBytes: function (bytes) {
		return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')
	},

	// Inverse of calculateBytes. hexStr is a 4-char hex string (2 7-bit bytes packed).
	// TODO: verify actual device response format when live
	parseBytes: function (hexStr, scale = 10, signed = false) {
		if (!hexStr || hexStr.length < 4) return null
		const msb = parseInt(hexStr.substring(0, 2), 16)
		const lsb = parseInt(hexStr.substring(2, 4), 16)
		let scaled = (msb << 7) | lsb
		if (signed && scaled > 0x1fff) scaled -= 0x4000
		return scaled / scale
	},

	capturePinp: function (pinp) {
		let self = this
		// 1-byte params use size 000001, 2-byte params use 000002
		const params = [
			{ s: '00', n: '000001' }, // on PGM (bus select)
			{ s: '01', n: '000001' }, // on PVW (bus select)
			{ s: '02', n: '000001' }, // source
			{ s: '03', n: '000001' }, // type
			{ s: '04', n: '000002' }, // position H
			{ s: '06', n: '000002' }, // position V
			{ s: '08', n: '000002' }, // size
			{ s: '0A', n: '000002' }, // cropping H
			{ s: '0C', n: '000002' }, // cropping V
			{ s: '0E', n: '000001' }, // shape
			{ s: '0F', n: '000001' }, // border color
			{ s: '10', n: '000001' }, // border width
			{ s: '11', n: '000002' }, // view position H
			{ s: '13', n: '000002' }, // view position V
			{ s: '15', n: '000002' }, // zoom
		]
		for (const p of params) {
			self.sendRawCommand(`RQH:00${pinp}${p.s},${p.n};`)
		}
		setTimeout(() => self.checkVariables(), 500)
	},

	applyPinp: function (pinp) {
		let self = this
		// Re-send all captured raw values back to the device
		const params = [
			{ suffix: '00', key: `data_${pinp}00` }, // on PGM (bus select)
			{ suffix: '01', key: `data_${pinp}01` }, // on PVW (bus select)
			{ suffix: '02', key: `data_${pinp}02` }, // source (1 byte)
			{ suffix: '03', key: `data_${pinp}03` }, // type (1 byte)
			{ suffix: '04', key: `data_${pinp}04` }, // position H (2 bytes)
			{ suffix: '06', key: `data_${pinp}06` }, // position V (2 bytes)
			{ suffix: '08', key: `data_${pinp}08` }, // size (2 bytes)
			{ suffix: '0A', key: `data_${pinp}0A` }, // cropping H (2 bytes)
			{ suffix: '0C', key: `data_${pinp}0C` }, // cropping V (2 bytes)
			{ suffix: '0E', key: `data_${pinp}0E` }, // shape (1 byte)
			{ suffix: '0F', key: `data_${pinp}0F` }, // border color (1 byte)
			{ suffix: '10', key: `data_${pinp}10` }, // border width (1 byte)
			{ suffix: '11', key: `data_${pinp}11` }, // view pos H (2 bytes)
			{ suffix: '13', key: `data_${pinp}13` }, // view pos V (2 bytes)
			{ suffix: '15', key: `data_${pinp}15` }, // zoom (2 bytes)
		]
		for (const p of params) {
			const val = self.DATA[p.key]
			if (val !== undefined) {
				self.sendCommand(`00${pinp}${p.suffix}`, val)
			}
		}
	},

	captureDsk: function (dsk) {
		let self = this
		// 1-byte params use size 000001, 2-byte params (LEVEL) use 000002
		const params = [
			{ s: '00', n: '000001' }, // pgm sw
			{ s: '01', n: '000001' }, // pvw sw
			{ s: '02', n: '000001' }, // mode
			{ s: '03', n: '000001' }, // key source
			{ s: '04', n: '000001' }, // fill source
			{ s: '05', n: '000001' }, // type
			{ s: '06', n: '000002' }, // level (14-bit)
			{ s: '07', n: '000001' }, // gain
			{ s: '09', n: '000001' }, // mix level
		]
		for (const p of params) {
			self.sendRawCommand(`RQH:00${dsk}${p.s},${p.n};`)
		}
		setTimeout(() => self.checkVariables(), 500)
	},

	applyDsk: function (dsk) {
		let self = this
		const params = [
			{ suffix: '00', key: `data_${dsk}00` }, // pgm sw
			{ suffix: '01', key: `data_${dsk}01` }, // pvw sw
			{ suffix: '02', key: `data_${dsk}02` }, // mode
			{ suffix: '03', key: `data_${dsk}03` }, // key source
			{ suffix: '04', key: `data_${dsk}04` }, // fill source
			{ suffix: '05', key: `data_${dsk}05` }, // type
			{ suffix: '06', key: `data_${dsk}06` }, // level (2 bytes)
			{ suffix: '07', key: `data_${dsk}07` }, // gain
			{ suffix: '09', key: `data_${dsk}09` }, // mix level
		]
		for (const p of params) {
			const val = self.DATA[p.key]
			if (val !== undefined) {
				self.sendCommand(`00${dsk}${p.suffix}`, val)
			}
		}
	},

	validateSnapshotName: function (name) {
		return typeof name === 'string' && /^[A-Za-z0-9_-]+$/.test(name)
	},

	resolveSnapshotFile: function (name) {
		const file = path.resolve(SNAPSHOT_DIR, `${name}.json`)
		if (!file.startsWith(SNAPSHOT_DIR + path.sep) && file !== SNAPSHOT_DIR) {
			throw new Error(`Snapshot path traversal denied: ${name}`)
		}
		return file
	},

	saveSnapshot: function (name) {
		let self = this
		if (!self.validateSnapshotName(name)) {
			self.log('error', `Invalid snapshot name: ${name}`)
			return
		}
		try {
			if (!fs.existsSync(SNAPSHOT_DIR)) {
				fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
			}
			const file = self.resolveSnapshotFile(name)
			const data = {
				name,
				savedAt: new Date().toISOString(),
				device: self.config.host,
				data: Object.fromEntries(Object.entries(self.DATA).filter(([k]) => isCaptureKey(k))),
			}
			fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
			self.log('info', `Snapshot saved: ${file}`)
			self.checkFeedbacks('snapshot_exists')
		} catch (err) {
			self.log('error', `Save snapshot failed: ${err.message}`)
		}
	},

	loadSnapshot: function (name) {
		let self = this
		if (!self.validateSnapshotName(name)) {
			self.log('error', `Invalid snapshot name: ${name}`)
			return false
		}
		try {
			const file = self.resolveSnapshotFile(name)
			if (!fs.existsSync(file)) {
				self.log('error', `Snapshot not found: ${file}`)
				return false
			}
			const raw = fs.readFileSync(file, 'utf8')
			const snap = JSON.parse(raw)
			for (const [k, v] of Object.entries(snap.data)) {
				if (isCaptureKey(k)) self.DATA[k] = v
			}
			self.log('info', `Snapshot loaded: ${name} (saved ${snap.savedAt})`)
			return true
		} catch (err) {
			self.log('error', `Load snapshot failed: ${err.message}`)
			return false
		}
	},

	listSnapshots: function () {
		try {
			if (!fs.existsSync(SNAPSHOT_DIR)) return []
			return fs
				.readdirSync(SNAPSHOT_DIR)
				.filter((f) => f.endsWith('.json'))
				.map((f) => f.replace(/\.json$/, ''))
		} catch {
			return []
		}
	},

	deleteSnapshot: function (name) {
		let self = this
		if (!self.validateSnapshotName(name)) {
			self.log('error', `Invalid snapshot name: ${name}`)
			return
		}
		try {
			const file = self.resolveSnapshotFile(name)
			if (!fs.existsSync(file)) {
				self.log('warn', `Snapshot not found: ${file}`)
				return
			}
			fs.unlinkSync(file)
			self.log('info', `Snapshot deleted: ${name}`)
			self.checkFeedbacks('snapshot_exists')
		} catch (err) {
			self.log('error', `Delete snapshot failed: ${err.message}`)
		}
	},
}
