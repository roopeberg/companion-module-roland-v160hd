const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		const foregroundColor = combineRgb(255, 255, 255) // White
		const backgroundColorRed = combineRgb(255, 0, 0) // Red

		feedbacks.auxMute = {
			type: 'boolean',
			name: 'Aux Mute State',
			description: 'Indicate if Aux Channel is Muted',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: 'aux1',
					choices: [
						{ id: 'aux1', label: 'Aux 1' },
						{ id: 'aux2', label: 'Aux 2' },
						{ id: 'aux3', label: 'Aux 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Mute State',
					id: 'mute',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				if (opt.aux == 'aux1') {
					if (self.DATA.aux1mute == opt.mute) {
						return true
					}
				}

				if (opt.aux == 'aux2') {
					if (self.DATA.aux2mute == opt.mute) {
						return true
					}
				}

				if (opt.aux == 'aux3') {
					if (self.DATA.aux3mute == opt.mute) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.outputAssign = {
			type: 'boolean',
			name: 'Output Assign State',
			description: 'Indicate if Output is Assigned to a specific Source',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: self.CHOICES_OUTPUTS[0].id,
					choices: self.CHOICES_OUTPUTS,
				},
				{
					type: 'dropdown',
					label: 'Type',
					id: 'assign',
					default: self.CHOICES_OUTPUTSASSIGN[0].id,
					choices: self.CHOICES_OUTPUTSASSIGN,
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				if (opt.output == '00000A') {
					//hdmi 1 output
					if (self.DATA.hdmi1assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000B') {
					//hdmi 2 output
					if (self.DATA.hdmi2assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000C') {
					//hdmi 3 output
					if (self.DATA.hdmi3assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000D') {
					//sdi 1 output
					if (self.DATA.sdi1assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000E') {
					//sdi 2 output
					if (self.DATA.sdi2assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '00000F') {
					//sdi 3 output
					if (self.DATA.sdi3assign == opt.assign) {
						return true
					}
				}

				if (opt.output == '000110') {
					//usb output
					if (self.DATA.usbassign == opt.assign) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.auxLinkMode = {
			type: 'boolean',
			name: 'Aux Link Mode',
			description: 'Indicate if Aux Link Mode is Off, Auto Link, or Manual Link',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'Auto Link' },
						{ id: '02', label: 'Manual Link' },
					],
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				if (self.DATA.auxlinkmode == opt.mode) {
					return true
				}

				return false
			},
		}

		feedbacks.auxLink = {
			type: 'boolean',
			name: 'Aux Link State',
			description: 'Indicate if Aux Channel is Linked to PGM',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Aux',
					id: 'aux',
					default: 'aux1',
					choices: [
						{ id: 'aux1', label: 'Aux 1' },
						{ id: 'aux2', label: 'Aux 2' },
						{ id: 'aux3', label: 'Aux 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Link Mode',
					id: 'link',
					default: '00',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				if (opt.aux == 'aux1') {
					if (self.DATA.aux1link == opt.link) {
						return true
					}
				}

				if (opt.aux == 'aux2') {
					if (self.DATA.aux2link == opt.link) {
						return true
					}
				}

				if (opt.aux == 'aux3') {
					if (self.DATA.aux3link == opt.link) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.keyOnAir = {
			type: 'boolean',
			name: 'Key is Selected on Bus',
			description: 'Indicate if Key is Selected on Bus',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: '1B',
					choices: [
						{ id: '1B', label: 'PnP/Key 1' },
						{ id: '1C', label: 'PnP/Key 2' },
						{ id: '1D', label: 'PnP/Key 3' },
						{ id: '1E', label: 'PnP/Key 4' },
					],
				},
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: '00',
					choices: [
						{ id: '00', label: 'Program (PGM)' },
						{ id: '01', label: 'Preview (PVW)' },
					],
				},
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					default: '01',
					choices: [
						{ id: '00', label: 'Off' },
						{ id: '01', label: 'On' },
					],
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				let val = self.DATA[`data_${opt.pinp}${opt.bus}`]

				if (val !== undefined && val == opt.onoff) {
					return true
				}

				return false
			},
		}

		feedbacks.freeze = {
			type: 'boolean',
			name: 'Freeze State',
			description: 'Indicate if Freeze is On or Off',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [],
			callback: function (_feedback, _bank) {
				if (self.DATA.freeze == '01') {
					return true
				}

				return false
			},
		}

		feedbacks.pnpKeySource = {
			type: 'boolean',
			name: 'PnP/Key Source State',
			description: 'Indicate if PnP/Key Source is Selected on PnP/Key',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'PnP/Key',
					id: 'pinp',
					default: 'pnpkey1',
					choices: [
						{ id: 'pnpkey1', label: 'PnP/Key 1' },
						{ id: 'pnpkey2', label: 'PnP/Key 2' },
						{ id: 'pnpkey3', label: 'PnP/Key 3' },
						{ id: 'pnpkey4', label: 'PnP/Key 4' },
					],
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.CHOICES_PNPKEY_SOURCES[0].id,
					choices: self.CHOICES_PNPKEY_SOURCES,
				},
			],
			callback: function (feedback, _bank) {
				let opt = feedback.options

				let obj = self.DATA[opt.pinp + 'source']

				if (obj == opt.source) {
					return true
				}

				return false
			},
		}

		feedbacks.bus_tally = {
			type: 'boolean',
			name: 'Bus Tally (per bus)',
			description: 'True when the given source is active on the selected bus (PGM, PVW, AUX1–3)',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: 'pgm',
					choices: [
						{ id: 'pgm', label: 'Program (PGM)' },
						{ id: 'pvw', label: 'Preview (PVW)' },
						{ id: 'aux1', label: 'AUX 1' },
						{ id: 'aux2', label: 'AUX 2' },
						{ id: 'aux3', label: 'AUX 3' },
					],
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.CHOICES_PGMPVW_SELECT[0].id,
					choices: self.CHOICES_PGMPVW_SELECT,
				},
			],
			callback: function (feedback) {
				let opt = feedback.options
				let busKey =
					opt.bus === 'pgm'
						? 'pgm_source'
						: opt.bus === 'pvw'
							? 'pvw_source'
							: opt.bus === 'aux1'
								? 'aux1source'
								: opt.bus === 'aux2'
									? 'aux2source'
									: 'aux3source'
				return self.DATA[busKey] == opt.source
			},
		}

		feedbacks.snapshot_exists = {
			name: 'Snapshot File Exists',
			type: 'boolean',
			defaultStyle: {},
			options: [
				{
					type: 'textinput',
					label: 'Snapshot name',
					id: 'name',
					default: 'snapshot1',
				},
			],
			callback: function (feedback) {
				return self.listSnapshots().includes(feedback.options.name)
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
