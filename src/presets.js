const { combineRgb } = require('@companion-module/base')

module.exports = {
	initPresets: function () {
		let self = this

		const WHITE = combineRgb(255, 255, 255)
		const RED = combineRgb(204, 0, 0)
		const GREEN = combineRgb(0, 180, 0)
		const ORANGE = combineRgb(210, 120, 0)
		const DARK = combineRgb(30, 30, 30)
		const CYAN = combineRgb(0, 160, 200)
		const PURPLE = combineRgb(120, 0, 180)

		// Source groups
		const HDMI_SOURCES = Array.from({ length: 8 }, (_, i) => ({
			label: `HDMI ${i + 1}`,
			pgmpvw_id: i.toString(16).padStart(2, '0').toUpperCase(),
			tally_id: i,
		}))
		const SDI_SOURCES = Array.from({ length: 8 }, (_, i) => ({
			label: `SDI ${i + 1}`,
			pgmpvw_id: (8 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: 8 + i,
		}))
		const STILL_SOURCES = Array.from({ length: 16 }, (_, i) => ({
			label: `Still ${i + 1}`,
			pgmpvw_id: (0x10 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: null,
		}))
		const XPT_SOURCES = Array.from({ length: 10 }, (_, i) => ({
			label: `INPUT ${i + 1}`,
			pgmpvw_id: (0x20 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: 32 + i,
		}))

		const AUX_DESTS = [
			{ label: 'AUX 1', aux_address: '000011', feedback_aux: 'aux1', color: ORANGE },
			{ label: 'AUX 2', aux_address: '00002E', feedback_aux: 'aux2', color: ORANGE },
			{ label: 'AUX 3', aux_address: '00002F', feedback_aux: 'aux3', color: ORANGE },
		]
		const pgmpvwDests = [
			{ label: 'PGM', actionId: 'select_pgm', tally_state: 'program', activeColor: RED },
			{ label: 'PVW', actionId: 'select_pvw', tally_state: 'preview', activeColor: GREEN },
		]
		const sourceGroups = [
			{ name: 'HDMI', sources: HDMI_SOURCES },
			{ name: 'SDI', sources: SDI_SOURCES },
			{ name: 'Still', sources: STILL_SOURCES },
			{ name: 'XPT', sources: XPT_SOURCES },
		]

		// Accumulate into API v2 format: keyed presets object + structure sections
		const presets = {}
		const structure = []

		function addSection(id, name, ids) {
			structure.push({ id, name, definitions: ids })
		}

		// PGM / PVW presets
		for (const dest of pgmpvwDests) {
			for (const group of sourceGroups) {
				const sectionId = `${dest.label.toLowerCase()}_${group.name.toLowerCase()}`
				const sectionIds = []
				for (const src of group.sources) {
					const id = `${sectionId}_${src.pgmpvw_id}`
					const feedbacks = []
					if (src.tally_id !== null) {
						feedbacks.push({
							feedbackId: 'tally',
							options: { input: src.tally_id, state: dest.tally_state },
							style: { color: WHITE, bgcolor: dest.activeColor },
						})
					}
					presets[id] = {
						name: `${dest.label}: ${src.label}`,
						type: 'simple',
						style: { text: src.label, size: 'auto', color: WHITE, bgcolor: DARK },
						steps: [{ down: [{ actionId: dest.actionId, options: { input: src.pgmpvw_id } }], up: [] }],
						feedbacks,
					}
					sectionIds.push(id)
				}
				addSection(sectionId, `${dest.label} - ${group.name}`, sectionIds)
			}
		}

		// AUX presets
		for (const aux of AUX_DESTS) {
			for (const group of sourceGroups) {
				const sectionId = `${aux.label.toLowerCase().replace(' ', '')}_${group.name.toLowerCase()}`
				const sectionIds = []
				for (const src of group.sources) {
					const id = `${sectionId}_${src.pgmpvw_id}`
					presets[id] = {
						name: `${aux.label}: ${src.label}`,
						type: 'simple',
						style: { text: src.label, size: 'auto', color: WHITE, bgcolor: DARK },
						steps: [
							{
								down: [{ actionId: 'aux_assign', options: { aux: aux.aux_address, assign: src.pgmpvw_id } }],
								up: [],
							},
						],
						feedbacks: [
							{
								feedbackId: 'auxTally',
								options: { aux: aux.feedback_aux, assign: src.pgmpvw_id },
								style: { color: WHITE, bgcolor: aux.color },
							},
						],
					}
					sectionIds.push(id)
				}
				addSection(sectionId, `${aux.label} - ${group.name}`, sectionIds)
			}
		}

		// PiP Capture / Apply
		const pipIds = []
		const pipTargets = [
			{ id: '1B', n: 1 }, { id: '1C', n: 2 }, { id: '1D', n: 3 }, { id: '1E', n: 4 },
		]
		for (const p of pipTargets) {
			const capId = `capture_pip${p.n}`
			const applyId = `apply_pip${p.n}`
			presets[capId] = {
				name: `Capture PiP ${p.n}`,
				type: 'simple',
				style: { text: `CAPTURE\nPiP ${p.n}`, size: 'auto', color: WHITE, bgcolor: CYAN },
				steps: [{ down: [{ actionId: 'capture_pinp', options: { pinp: p.id } }], up: [] }],
				feedbacks: [],
			}
			presets[applyId] = {
				name: `Apply PiP ${p.n}`,
				type: 'simple',
				style: { text: `APPLY\nPiP ${p.n}`, size: 'auto', color: WHITE, bgcolor: PURPLE },
				steps: [{ down: [{ actionId: 'apply_pinp', options: { pinp: p.id } }], up: [] }],
				feedbacks: [],
			}
			pipIds.push(capId, applyId)
		}
		addSection('pip_capture_apply', 'PiP Capture / Apply', pipIds)

		// DSK Capture / Apply
		const dskIds = []
		const dskTargets = [{ id: '1F', n: 1 }, { id: '20', n: 2 }]
		for (const d of dskTargets) {
			const capId = `capture_dsk${d.n}`
			const applyId = `apply_dsk${d.n}`
			presets[capId] = {
				name: `Capture DSK ${d.n}`,
				type: 'simple',
				style: { text: `CAPTURE\nDSK ${d.n}`, size: 'auto', color: WHITE, bgcolor: CYAN },
				steps: [{ down: [{ actionId: 'capture_dsk', options: { dsk: d.id } }], up: [] }],
				feedbacks: [],
			}
			presets[applyId] = {
				name: `Apply DSK ${d.n}`,
				type: 'simple',
				style: { text: `APPLY\nDSK ${d.n}`, size: 'auto', color: WHITE, bgcolor: PURPLE },
				steps: [{ down: [{ actionId: 'apply_dsk', options: { dsk: d.id } }], up: [] }],
				feedbacks: [],
			}
			dskIds.push(capId, applyId)
		}
		addSection('dsk_capture_apply', 'DSK Capture / Apply', dskIds)

		self.setPresetDefinitions(structure, presets)
	},
}
