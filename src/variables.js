module.exports = {
	initVariables: function () {
		let self = this
		let variables = {}

		variables.model = { name: 'Model' }
		variables.version = { name: 'Version' }

		for (let i = 0; i < self.TALLYDATA.length; i++) {
			variables['tally_' + self.TALLYDATA[i].shortlabel] = {
				name: self.TALLYDATA[i].label + ' Tally',
			}
		}

		variables.pnpkey1_pgm = { name: 'PnP/Key 1 on PGM' }
		variables.pnpkey1_pvw = { name: 'PnP/Key 1 on PVW' }
		variables.pnpkey2_pgm = { name: 'PnP/Key 2 on PGM' }
		variables.pnpkey2_pvw = { name: 'PnP/Key 2 on PVW' }
		variables.pnpkey3_pgm = { name: 'PnP/Key 3 on PGM' }
		variables.pnpkey3_pvw = { name: 'PnP/Key 3 on PVW' }
		variables.pnpkey4_pgm = { name: 'PnP/Key 4 on PGM' }
		variables.pnpkey4_pvw = { name: 'PnP/Key 4 on PVW' }

		//PGM/PVW current source
		variables.pgm_source = { name: 'PGM Current Source' }
		variables.pvw_source = { name: 'PVW Current Source' }

		//pnp/key sources
		variables.pnpkey1_source = { name: 'PnP/Key 1 Source' }
		variables.pnpkey2_source = { name: 'PnP/Key 2 Source' }
		variables.pnpkey3_source = { name: 'PnP/Key 3 Source' }
		variables.pnpkey4_source = { name: 'PnP/Key 4 Source' }

		//Output Assigns
		variables.hdmi1 = { name: 'HDMI Output 1 Source' }
		variables.hdmi2 = { name: 'HDMI Output 2 Source' }
		variables.hdmi3 = { name: 'HDMI Output 3 Source' }
		variables.sdi1 = { name: 'SDI Output 1 Source' }
		variables.sdi2 = { name: 'SDI Output 2 Source' }
		variables.sdi3 = { name: 'SDI Output 3 Source' }
		variables.usb = { name: 'USB Output Source' }

		//Aux Assigns
		variables.aux1 = { name: 'Aux 1 Source' }
		variables.aux2 = { name: 'Aux 2 Source' }
		variables.aux3 = { name: 'Aux 3 Source' }

		variables.aux1_mute = { name: 'Aux 1 Mute' }
		variables.aux2_mute = { name: 'Aux 2 Mute' }
		variables.aux3_mute = { name: 'Aux 3 Mute' }

		variables.auxlink_mode = { name: 'Aux Link Mode' }
		variables.aux1link = { name: 'Aux 1 Link' }
		variables.aux2link = { name: 'Aux 2 Link' }
		variables.aux3link = { name: 'Aux 3 Link' }

		variables.transition_type = { name: 'Transition Type (Mix/Wipe)' }
		variables.mix_type = { name: 'Mix Type' }
		variables.wipe_type = { name: 'Wipe Type' }
		variables.wipe_direction = { name: 'Wipe Direction' }

		variables.freeze = { name: 'Freeze On/Off' }
		variables.freeze_type = { name: 'Freeze Type (All/Select)' }
		variables.freeze_select_mode = { name: 'Freeze Select Mode Active' }
		for (let i = 1; i <= 8; i++) {
			variables[`freeze_select_hdmi${i}`] = {
				name: `Freeze Select HDMI IN ${i}`,
			}
			variables[`freeze_select_sdi${i}`] = {
				name: `Freeze Select SDI IN ${i}`,
			}
		}

		// PiP captured settings (populated by Capture PiP action)
		const pipIds = [
			{ n: 1, id: '1B' },
			{ n: 2, id: '1C' },
			{ n: 3, id: '1D' },
			{ n: 4, id: '1E' },
		]
		for (const p of pipIds) {
			variables[`pip${p.n}_source`] = { name: `PiP ${p.n} Captured Source` }
			variables[`pip${p.n}_type`] = { name: `PiP ${p.n} Captured Type` }
			variables[`pip${p.n}_positionH`] = {
				name: `PiP ${p.n} Captured Position H (%)`,
			}
			variables[`pip${p.n}_positionV`] = {
				name: `PiP ${p.n} Captured Position V (%)`,
			}
			variables[`pip${p.n}_size`] = { name: `PiP ${p.n} Captured Size (%)` }
			variables[`pip${p.n}_croppingH`] = {
				name: `PiP ${p.n} Captured Cropping H (%)`,
			}
			variables[`pip${p.n}_croppingV`] = {
				name: `PiP ${p.n} Captured Cropping V (%)`,
			}
			variables[`pip${p.n}_shape`] = { name: `PiP ${p.n} Captured Shape` }
			variables[`pip${p.n}_borderColor`] = {
				name: `PiP ${p.n} Captured Border Color`,
			}
			variables[`pip${p.n}_borderWidth`] = {
				name: `PiP ${p.n} Captured Border Width`,
			}
			variables[`pip${p.n}_viewPosH`] = {
				name: `PiP ${p.n} Captured View Pos H (%)`,
			}
			variables[`pip${p.n}_viewPosV`] = {
				name: `PiP ${p.n} Captured View Pos V (%)`,
			}
			variables[`pip${p.n}_zoom`] = { name: `PiP ${p.n} Captured Zoom (%)` }
		}

		// DSK captured settings (populated by Capture DSK action)
		const dskIds = [
			{ n: 1, id: '1F' },
			{ n: 2, id: '20' },
		]
		for (const d of dskIds) {
			variables[`dsk${d.n}_keySource`] = {
				name: `DSK ${d.n} Captured Key Source`,
			}
			variables[`dsk${d.n}_fillSource`] = {
				name: `DSK ${d.n} Captured Fill Source`,
			}
			variables[`dsk${d.n}_type`] = { name: `DSK ${d.n} Captured Type` }
		}

		// Source labels (read from device LABEL EDIT area)
		for (let i = 1; i <= 8; i++) {
			variables[`label_hdmi_${i}`] = { name: `HDMI IN ${i} Label` }
			variables[`label_sdi_${i}`] = { name: `SDI IN ${i} Label` }
		}
		for (let i = 1; i <= 16; i++) {
			variables[`label_still_${i}`] = { name: `Still ${i} Label` }
		}
		variables.label_pgm = { name: 'PGM Bus Label' }
		variables.label_subpgm = { name: 'Sub PGM Bus Label' }
		variables.label_pvw = { name: 'PVW Bus Label' }
		variables.label_aux1 = { name: 'AUX 1 Bus Label' }
		variables.label_aux2 = { name: 'AUX 2 Bus Label' }
		variables.label_aux3 = { name: 'AUX 3 Bus Label' }
		variables.label_dsk1src = { name: 'DSK 1 Source Label' }
		variables.label_dsk2src = { name: 'DSK 2 Source Label' }

		//memory names
		for (let i = 1; i <= 30; i++) {
			variables['memoryname_' + i] = { name: 'Memory Name ' + i }
		}

		//last memory loaded, number and name
		variables.lastmemorynumber = { name: 'Last Memory Number Loaded' }
		variables.lastmemoryname = { name: 'Last Memory Name Loaded' }

		self.setVariableDefinitions(variables)

		// Set source label defaults immediately so buttons show something before device responds.
		const labelDefaults = {}
		for (let i = 1; i <= 8; i++) {
			labelDefaults[`label_hdmi_${i}`] = `HDMI ${i}`
			labelDefaults[`label_sdi_${i}`] = `SDI ${i}`
		}
		for (let i = 1; i <= 16; i++) {
			labelDefaults[`label_still_${i}`] = `STILL ${i}`
		}
		labelDefaults.label_pgm = 'PGM'
		labelDefaults.label_subpgm = 'SUB PGM'
		labelDefaults.label_pvw = 'PVW'
		labelDefaults.label_aux1 = 'AUX 1'
		labelDefaults.label_aux2 = 'AUX 2'
		labelDefaults.label_aux3 = 'AUX 3'
		labelDefaults.label_dsk1src = 'DSK 1 SRC'
		labelDefaults.label_dsk2src = 'DSK 2 SRC'
		self.setVariableValues(labelDefaults)
	},

	checkVariables: function () {
		let self = this

		try {
			let variableObj = {}

			variableObj.model = self.MODEL
			variableObj.version = self.VERSION

			for (let i = 0; i < self.TALLYDATA.length; i++) {
				let state = 'Off'

				if (self.TALLYDATA[i].status == 1 || self.TALLYDATA[i].status == 3) {
					state = 'Program'
				} else if (self.TALLYDATA[i].status == 2) {
					state = 'Preview'
				}

				variableObj['tally_' + self.TALLYDATA[i].shortlabel] = state
			}

			//PnP/Keys
			variableObj.pnpkey1_pgm = self.DATA.data_1B00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey1_pvw = self.DATA.data_1B01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey2_pgm = self.DATA.data_1C00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey2_pvw = self.DATA.data_1C01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey3_pgm = self.DATA.data_1D00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey3_pvw = self.DATA.data_1D01 == '01' ? 'On' : 'Off'
			variableObj.pnpkey4_pgm = self.DATA.data_1E00 == '01' ? 'On' : 'Off'
			variableObj.pnpkey4_pvw = self.DATA.data_1E01 == '01' ? 'On' : 'Off'

			//pnpkey sources
			variableObj['pnpkey1_source'] = self.DATA.pnpkey1sourcename
			variableObj['pnpkey2_source'] = self.DATA.pnpkey2sourcename
			variableObj['pnpkey3_source'] = self.DATA.pnpkey3sourcename
			variableObj['pnpkey4_source'] = self.DATA.pnpkey4sourcename

			//Output Assigns
			let hdmi1assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi1assign
			})
			let hdmi2assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi2assign
			})
			let hdmi3assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.hdmi3assign
			})
			let sdi1assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi1assign
			})
			let sdi2assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi2assign
			})
			let sdi3assign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.sdi3assign
			})
			let usbassign = self.CHOICES_OUTPUTSASSIGN.find((item) => {
				return item.id == self.DATA.usbassign
			})

			if (hdmi1assign !== undefined) {
				variableObj.hdmi1 = hdmi1assign.label
			} else {
				variableObj.hdmi1 = self.DATA.hdmi1assign
			}

			if (hdmi2assign !== undefined) {
				variableObj.hdmi2 = hdmi2assign.label
			} else {
				variableObj.hdmi2 = self.DATA.hdmi2assign
			}

			if (hdmi3assign !== undefined) {
				variableObj.hdmi3 = hdmi3assign.label
			} else {
				variableObj.hdmi3 = self.DATA.hdmi3assign
			}

			if (sdi1assign !== undefined) {
				variableObj.sdi1 = sdi1assign.label
			} else {
				variableObj.sdi1 = self.DATA.sdi1assign
			}

			if (sdi2assign !== undefined) {
				variableObj.sdi2 = sdi2assign.label
			} else {
				variableObj.sdi2 = self.DATA.sdi2assign
			}

			if (sdi3assign !== undefined) {
				variableObj.sdi3 = sdi3assign.label
			} else {
				variableObj.sdi3 = self.DATA.sdi3assign
			}

			if (usbassign !== undefined) {
				variableObj.usb = usbassign.label
			} else {
				variableObj.usb = self.DATA.usbassign
			}

			//PGM/PVW current source
			let pgmSrc = self.CHOICES_PGMPVW_SELECT.find((item) => item.id == self.DATA.pgm_source)
			let pvwSrc = self.CHOICES_PGMPVW_SELECT.find((item) => item.id == self.DATA.pvw_source)
			variableObj.pgm_source = pgmSrc ? pgmSrc.label : (self.DATA.pgm_source ?? '-')
			variableObj.pvw_source = pvwSrc ? pvwSrc.label : (self.DATA.pvw_source ?? '-')

			//Aux Sources
			let aux1source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux1source
			})
			let aux2source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux2source
			})
			let aux3source = self.CHOICES_PGMPVW_SELECT.find((item) => {
				return item.id == self.DATA.aux3source
			})

			if (aux1source !== undefined) {
				variableObj.aux1 = aux1source.label
			} else {
				variableObj.aux1 = self.DATA.aux1source
			}

			if (aux2source !== undefined) {
				variableObj.aux2 = aux2source.label
			} else {
				variableObj.aux2 = self.DATA.aux2source
			}

			if (aux3source !== undefined) {
				variableObj.aux3 = aux3source.label
			} else {
				variableObj.aux3 = self.DATA.aux3source
			}

			//Aux Mutes
			variableObj.aux1_mute = self.DATA.aux1mute == '01' ? 'On' : 'Off'
			variableObj.aux2_mute = self.DATA.aux2mute == '01' ? 'On' : 'Off'
			variableObj.aux3_mute = self.DATA.aux3mute == '01' ? 'On' : 'Off'

			//Aux Links
			variableObj.auxlink_mode =
				self.DATA.auxlinkmode == '00' ? 'Off' : self.DATA.auxlinkmode == '01' ? 'Auto Link' : 'Manual Link'
			variableObj.aux1link = self.DATA.aux1link == '01' ? 'On' : 'Off'
			variableObj.aux2link = self.DATA.aux2link == '01' ? 'On' : 'Off'
			variableObj.aux3link = self.DATA.aux3link == '01' ? 'On' : 'Off'

			//Transition
			const TRANS_TYPE_LABELS = ['Mix', 'Wipe']
			const MIX_TYPE_LABELS = ['Mix', 'Fam', 'Nam']
			const WIPE_TYPE_LABELS = [
				'Horizontal',
				'Vertical',
				'Upper Left',
				'Upper Right',
				'Lower Left',
				'Lower Right',
				'H-Center',
				'V-Center',
			]
			const WIPE_DIR_LABELS = ['Normal', 'Reverse', 'Round Trip']
			variableObj.transition_type = TRANS_TYPE_LABELS[self.DATA.transition_type] ?? '-'
			variableObj.mix_type = MIX_TYPE_LABELS[self.DATA.mix_type] ?? '-'
			variableObj.wipe_type = WIPE_TYPE_LABELS[self.DATA.wipe_type] ?? '-'
			variableObj.wipe_direction = WIPE_DIR_LABELS[self.DATA.wipe_direction] ?? '-'

			//Freeze
			variableObj.freeze = self.DATA.freeze == '01' ? 'On' : 'Off'
			variableObj.freeze_type = self.DATA.freeze_type == '01' ? 'Select' : 'All'
			variableObj.freeze_select_mode = self.freeze_select_mode ? 'Active' : 'Off'
			// HDMI IN 1-8: addresses 02-09, SDI IN 1-8: addresses 0A-11
			for (let i = 0; i < 8; i++) {
				const hdmiAddr = (i + 2).toString(16).padStart(2, '0').toUpperCase()
				const sdiAddr = (i + 0x0a).toString(16).padStart(2, '0').toUpperCase()
				variableObj[`freeze_select_hdmi${i + 1}`] =
					self.DATA[`freeze_select_${hdmiAddr}`] == '01' ? 'Enabled' : 'Disabled'
				variableObj[`freeze_select_sdi${i + 1}`] =
					self.DATA[`freeze_select_${sdiAddr}`] == '01' ? 'Enabled' : 'Disabled'
			}

			// PiP captured settings
			const SHAPE_LABELS = {
				'00': 'Rectangle',
				'01': 'Circle',
				'02': 'Diamond',
			}
			const BORDER_COLOR_LABELS = {
				'00': 'White',
				'01': 'Yellow',
				'02': 'Cyan',
				'03': 'Green',
				'04': 'Magenta',
				'05': 'Red',
				'06': 'Blue',
				'07': 'Black',
				'08': 'Custom',
				'09': 'Soft Edge',
			}
			const PIP_TYPE_LABELS = {
				'00': 'PinP',
				'01': 'Lum-White Key',
				'02': 'Lum-Black Key',
				'03': 'Chroma Key',
			}
			const pipIds = [
				{ n: 1, id: '1B' },
				{ n: 2, id: '1C' },
				{ n: 3, id: '1D' },
				{ n: 4, id: '1E' },
			]
			for (const p of pipIds) {
				const d = self.DATA
				const srcLookup = self.CHOICES_PNPKEY_SOURCES.find((x) => x.id == d[`data_${p.id}02`])
				variableObj[`pip${p.n}_source`] = srcLookup ? srcLookup.label : (d[`data_${p.id}02`] ?? '-')
				variableObj[`pip${p.n}_type`] = PIP_TYPE_LABELS[d[`data_${p.id}03`]] ?? d[`data_${p.id}03`] ?? '-'
				variableObj[`pip${p.n}_positionH`] = self.parseBytes(d[`data_${p.id}04`], 10, true) ?? '-'
				variableObj[`pip${p.n}_positionV`] = self.parseBytes(d[`data_${p.id}06`], 10, true) ?? '-'
				variableObj[`pip${p.n}_size`] = self.parseBytes(d[`data_${p.id}08`], 10, false) ?? '-'
				variableObj[`pip${p.n}_croppingH`] = self.parseBytes(d[`data_${p.id}0A`], 10, false) ?? '-'
				variableObj[`pip${p.n}_croppingV`] = self.parseBytes(d[`data_${p.id}0C`], 10, false) ?? '-'
				variableObj[`pip${p.n}_shape`] = SHAPE_LABELS[d[`data_${p.id}0E`]] ?? d[`data_${p.id}0E`] ?? '-'
				variableObj[`pip${p.n}_borderColor`] = BORDER_COLOR_LABELS[d[`data_${p.id}0F`]] ?? d[`data_${p.id}0F`] ?? '-'
				variableObj[`pip${p.n}_borderWidth`] =
					d[`data_${p.id}10`] !== undefined ? parseInt(d[`data_${p.id}10`], 16) : '-'
				variableObj[`pip${p.n}_viewPosH`] = self.parseBytes(d[`data_${p.id}11`], 10, true) ?? '-'
				variableObj[`pip${p.n}_viewPosV`] = self.parseBytes(d[`data_${p.id}13`], 10, true) ?? '-'
				variableObj[`pip${p.n}_zoom`] = self.parseBytes(d[`data_${p.id}15`], 1, false) ?? '-'
			}

			// DSK captured settings
			const DSK_TYPE_LABELS = {
				'00': 'Lum-White',
				'01': 'Lum-Black',
				'02': 'Chroma',
			}
			const dskIds = [
				{ n: 1, id: '1F' },
				{ n: 2, id: '20' },
			]
			for (const dk of dskIds) {
				const d = self.DATA
				const keySrcLookup = self.CHOICES_INPUTSASSIGN.find((x) => x.id == parseInt(d[`data_${dk.id}03`], 16))
				const fillSrcLookup = self.CHOICES_INPUTSASSIGN.find((x) => x.id == parseInt(d[`data_${dk.id}04`], 16))
				variableObj[`dsk${dk.n}_keySource`] = keySrcLookup ? keySrcLookup.label : (d[`data_${dk.id}03`] ?? '-')
				variableObj[`dsk${dk.n}_fillSource`] = fillSrcLookup ? fillSrcLookup.label : (d[`data_${dk.id}04`] ?? '-')
				variableObj[`dsk${dk.n}_type`] = DSK_TYPE_LABELS[d[`data_${dk.id}05`]] ?? d[`data_${dk.id}05`] ?? '-'
			}

			self.setVariableValues(variableObj)
		} catch (error) {
			self.log('error', 'Error setting Variables from Device: ' + String(error))
		}
	},
}
