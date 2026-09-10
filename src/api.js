const { InstanceStatus, TCPHelper } = require('@companion-module/base')
const { extractMessages } = require('./tcpParser')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SNAPSHOT_DIR = path.join(os.homedir(), 'v160hd-snapshots')

module.exports = {
	initConnection: function () {
		let self = this

		// Stop polling before tearing down the socket so no commands are sent
		// to a dead or not-yet-authenticated connection.
		if (self.INTERVAL !== undefined) {
			clearInterval(self.INTERVAL)
			self.INTERVAL = undefined
		}

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

			self.socket = new TCPHelper(self.config.host, self.config.port)

			self.socket.on('error', function (err) {
				if (self.config.verbose) {
					self.log('warn', 'Error: ' + err)
				}

				clearInterval(self.INTERVAL)
				self.INTERVAL = undefined
				self.handleError(err)
			})

			self.socket.on('connect', function () {
				self.log('info', 'Connected — waiting for auth prompt')
				self.updateStatus(InstanceStatus.Connecting, 'Authenticating')
			})

			self.socket.on('end', function () {
				self.log('warn', 'Connection closed by device')
				clearInterval(self.INTERVAL)
				self.INTERVAL = undefined
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Closed')
				self.startReconnectInterval()
			})

			self.socket.on('close', function () {
				if (self.INTERVAL !== undefined) {
					clearInterval(self.INTERVAL)
					self.INTERVAL = undefined
				}
			})

			self.tcpBuffer = ''

			self.socket.on('data', function (buffer) {
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
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					} else if (err[key] === 'ETIMEDOUT') {
						error =
							'Unable to communicate with Device. Connection timed out. Is this the right IP address? Is it still online?'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Timed Out')
						printedError = true
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					} else if (err[key] === 'ECONNRESET') {
						error = 'The connection was reset. Check the log for more error information.'
						self.log('error', error)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Reset')
						printedError = true
						if (self.socket !== undefined) {
							self.socket.destroy()
						}
						self.startReconnectInterval()
					}
				}
			})

			if (!printedError) {
				self.log('error', `Network error: ${error}`)
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Network Error')
				if (self.socket !== undefined) {
					self.socket.destroy()
				}
				self.startReconnectInterval()
			}
		} catch (error) {
			self.log('error', 'Error handling error: ' + error)
			self.log('error', 'Error: ' + String(err))
		}
	},

	startReconnectInterval: function () {
		let self = this

		self.updateStatus(InstanceStatus.ConnectionFailure, 'Reconnecting')

		if (self.RECONNECT_INTERVAL !== undefined) {
			clearInterval(self.RECONNECT_INTERVAL)
			self.RECONNECT_INTERVAL = undefined
		}

		self.log('info', 'Attempting to reconnect in 30 seconds...')

		self.RECONNECT_INTERVAL = setTimeout(self.initConnection.bind(this), 30000)
	},

	startInterval: function () {
		let self = this

		if (self.INTERVAL !== undefined) {
			clearInterval(self.INTERVAL)
			self.INTERVAL = undefined
		}

		if (self.config.polling) {
			const MIN_RATE = 300
			const MAX_RATE = 30000
			const DEFAULT_RATE = 500
			const raw = String(self.config.pollingrate ?? '').trim()
			const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN
			const rate = Number.isFinite(parsed) ? Math.min(MAX_RATE, Math.max(MIN_RATE, parsed)) : DEFAULT_RATE
			if (rate !== parsed) {
				self.log('warn', `Polling rate clamped to ${rate} ms (was '${self.config.pollingrate}')`)
			}
			self.log('info', `Starting Update Interval: Fetching new data from Device every ${rate}ms.`)
			self.INTERVAL = setInterval(self.getData.bind(this), rate)
		} else {
			self.log('info', 'Polling is disabled. Module will not request new data at a regular rate.')
		}
	},

	getData: function () {
		let self = this

		//self.getTallyData();
		self.getPinpKeyData()
		self.getAuxData()
		self.getFreezeData()
		self.getOutputData()
		self.getAuxLinkData()
		self.getNextMemoryName()
		self.getLastMemoryLoaded()
	},

	getPinpKeyData: function () {
		let self = this

		self.sendRawCommand('RQH:001B00,000001;') //PnP/Key 1 on PGM
		self.sendRawCommand('RQH:001B01,000001;') //PnP/Key 1 on PVW
		self.sendRawCommand('RQH:001C00,000001;') //PnP/Key 2 on PGM
		self.sendRawCommand('RQH:001C01,000001;') //PnP/Key 2 on PVW
		self.sendRawCommand('RQH:001D00,000001;') //PnP/Key 3 on PGM
		self.sendRawCommand('RQH:001D01,000001;') //PnP/Key 3 on PVW
		self.sendRawCommand('RQH:001E00,000001;') //PnP/Key 4 on PGM
		self.sendRawCommand('RQH:001E01,000001;') //PnP/Key 4 on PVW

		//get sources for pnp/keys
		self.sendRawCommand('RQH:001B02,000001;') //PnP/Key 1 source
		self.sendRawCommand('RQH:001C02,000001;') //PnP/Key 2 source
		self.sendRawCommand('RQH:001D02,000001;') //PnP/Key 3 source
		self.sendRawCommand('RQH:001E02,000001;') //PnP/Key 4 source
	},

	getAuxData: function () {
		let self = this

		self.sendRawCommand('RQH:002100,000001;') //PGM current source
		self.sendRawCommand('RQH:002101,000001;') //PVW current source
		self.sendRawCommand('RQH:000011,000001;') //Aux 1 current source
		self.sendRawCommand('RQH:00002E,000001;') //Aux 2 current source
		self.sendRawCommand('RQH:00002F,000001;') //Aux 3 current source

		self.sendRawCommand('RQH:012203,000001;') //Aux 1 mute
		self.sendRawCommand('RQH:012503,000001;') //Aux 2 mute
		self.sendRawCommand('RQH:012603,000001;') //Aux 3 mute
	},

	getFreezeData: function () {
		let self = this

		self.sendRawCommand('RQH:020500,000001;') //Freeze on/off
	},

	getOutputData: function () {
		let self = this

		self.sendRawCommand('RQH:00000A,000001;') //HDMI 1 output assign
		self.sendRawCommand('RQH:00000B,000001;') //HDMI 2 output assign
		self.sendRawCommand('RQH:00000C,000001;') //HDMI 3 output assign
		self.sendRawCommand('RQH:00000D,000001;') //SDI 1 output assign
		self.sendRawCommand('RQH:00000E,000001;') //SDI 2 output assign
		self.sendRawCommand('RQH:00000F,000001;') //SDI 3 output assign
		self.sendRawCommand('RQH:000110,000001;') //USB output assign
	},

	getAuxLinkData: function () {
		let self = this

		self.sendRawCommand('RQH:02010D,000001;') //Aux Link Mode Off/Auto/Manual
		self.sendRawCommand('RQH:020154,000001;') //Aux 1 link on/off
		self.sendRawCommand('RQH:020155,000001;') //Aux 2 link on/off
		self.sendRawCommand('RQH:020156,000001;') //Aux 3 link on/off
	},

	/*getTallyData: function() {
		let self = this;

		for (let i = 0; i < 16; i++) {
			let hex = i.toString(16).padStart(2, '0').toUpperCase();
			let command = '0C' + '00' + hex + ',000001;';

			self.sendRawCommand('RQH:' + command);
		}
	},*/

	// Requests one memory slot's 8 name characters per poll cycle (8 RQH commands)
	// instead of all 240 at once. Cycles through memories 0–29 on successive calls.
	getNextMemoryName: function () {
		let self = this

		if (self.memoryNameIndex === undefined) {
			self.memoryNameIndex = 0
		}
		const i = self.memoryNameIndex
		const hexMemory = i.toString(16).padStart(2, '0').toUpperCase()
		for (let j = 0; j < 8; j++) {
			const hex = j.toString(16).padStart(2, '0').toUpperCase()
			self.sendRawCommand('RQH:60' + hexMemory + hex + ',000001;')
		}
		self.memoryNameIndex = (i + 1) % 30
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
		} else if (data.trim() == 'ERR:0;') {
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
						if (dataSet[1].toString().indexOf(',')) {
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
										//subscribe tally message
										self.logVerbose('Received Subscribe Tally Message')
										let index = 0
										let halfLength = value.length / 2
										for (let t = 0; t < halfLength; t++) {
											let input = halfLength - (halfLength - t)
											input = input.toString(16).padStart(2, '0').toUpperCase()

											let tallyState = value[index] + value[index + 1]
											tallyState = tallyState.toString(16).padStart(2, '0').toUpperCase()

											self.updateTally(input, tallyState)

											index = index + 2
										}
									}

									if (param1 == '00') {
										if (param2 == '21' && param3 == '00') {
											//PGM source
											self.logVerbose('Received PGM Source: ' + value)
											self.DATA.pgm_source = value
										} else if (param2 == '21' && param3 == '01') {
											//PVW source
											self.logVerbose('Received PVW Source: ' + value)
											self.DATA.pvw_source = value
										} else if (param2 == '00' && param3 == '11') {
											//aux 1 source
											self.logVerbose('Received Aux 1 Source: ' + value)
											self.DATA.aux1source = value
										} else if (param2 == '00' && param3 == '2E') {
											//aux 2 source
											self.logVerbose('Received Aux 2 Source: ' + value)
											self.DATA.aux2source = value
										} else if (param2 == '00' && param3 == '2F') {
											//aux 3 source
											self.logVerbose('Received Aux 3 Source: ' + value)
											self.DATA.aux3source = value
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
										} else {
											//other data
											self.DATA[`data_${param1}${param2}${param3}`] = value //this should take care of all requested data
											self.DATA[`data_${param2}${param3}`] = value //this should take care of all requested data
										}
									}

									if (param1 == '02' && param2 == '05' && param3 == '00') {
										//freeze state
										self.DATA.freeze = value
										self.logVerbose('Received Freeze State: ' + value)
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

									if (param1 == '00' && param2 == '00' && param3 == '0A') {
										//hdmi 1 output assign
										self.DATA.hdmi1assign = value
										self.logVerbose('Received HDMI 1 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0B') {
										//hdmi 2 output assign
										self.DATA.hdmi2assign = value
										self.logVerbose('Received HDMI 2 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0C') {
										//hdmi 3 output assign
										self.DATA.hdmi3assign = value
										self.logVerbose('Received HDMI 3 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0D') {
										//sdi 1 output assign
										self.DATA.sdi1assign = value
										self.logVerbose('Received SDI 1 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0E') {
										//sdi 2 output assign
										self.DATA.sdi2assign = value
										self.logVerbose('Received SDI 2 Output Assign: ' + value)
									}

									if (param1 == '00' && param2 == '00' && param3 == '0F') {
										//sdi 3 output assign
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
										//aux 1 link
										self.DATA.aux1link = value
										self.logVerbose('Received Aux 1 Link: ' + value)
									}

									if (param1 == '02' && param2 == '01' && param3 == '55') {
										//aux 2 link
										self.DATA.aux2link = value
										self.logVerbose('Received Aux 2 Link: ' + value)
									}

									if (param1 == '02' && param2 == '01' && param3 == '56') {
										//aux 3 link
										self.DATA.aux3link = value
										self.logVerbose('Received Aux 3 Link: ' + value)
									}

									if (param1 == '60') {
										//memory names — 8 chars, each arrives as a separate message
										//value is a 1-byte hex string (e.g. "41" = 'A')
										let memoryNumber = parseInt(param2, 16)
										let memoryCharIndex = parseInt(param3, 16)
										let char = String.fromCharCode(parseInt(value, 16))

										let memoryName = self.DATA[`memory${memoryNumber}`] || '        '
										if (memoryName.length < 8) {
											memoryName = memoryName.padEnd(8, ' ')
										}

										memoryName =
											memoryName.substring(0, memoryCharIndex) + char + memoryName.substring(memoryCharIndex + 1)

										self.DATA[`memory${memoryNumber}`] = memoryName
										let variableObj = {}
										variableObj[`memoryname_${memoryNumber + 1}`] = memoryName.trimEnd()
										self.setVariableValues(variableObj)
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
		self.sendRawCommand(cmd)
	},

	requestData: function (command) {
		let self = this

		let cmd = 'RQH:' + command + ';'
		self.sendRawCommand(cmd)
	},

	sendRawCommand: function (command) {
		let self = this

		let cmd = String(command).replace(/[\r\n]+$/g, '')
		if (!cmd.endsWith(';')) {
			cmd += ';'
		}
		cmd += '\n'

		if (self.socket !== undefined && self.socket.isConnected) {
			if (self.config.verbose) {
				self.log('debug', 'Sending: ' + cmd)
			}

			self.socket.send(cmd)
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
				data: { ...self.DATA },
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
			Object.assign(self.DATA, snap.data)
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
