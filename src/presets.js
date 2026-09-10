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
		const TEAL = combineRgb(0, 130, 120)
		const NAVY = combineRgb(20, 40, 100)
		const SAVE_COLOR = combineRgb(180, 80, 0)
		const LOAD_COLOR = combineRgb(0, 100, 180)

		const FONT_SIZE = 30 // % of element height

		// Build layered preset elements: background box + centered text label
		function layeredBtn(text, bgcolor) {
			return [
				{
					type: 'box',
					id: 'bg',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					color: bgcolor,
				},
				{
					type: 'text',
					id: 'label',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					text,
					fontsize: FONT_SIZE,
					fontsizeAllowShrink: false,
					color: WHITE,
					halign: 'center',
					valign: 'center',
				},
			]
		}

		function bgOverride(color) {
			return [{ elementId: 'bg', elementProperty: 'color', override: { isExpression: false, value: color } }]
		}

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
			{ label: 'AUX 1', aux_address: '000011', bus: 'aux1', color: ORANGE },
			{ label: 'AUX 2', aux_address: '00002E', bus: 'aux2', color: ORANGE },
			{ label: 'AUX 3', aux_address: '00002F', bus: 'aux3', color: ORANGE },
		]
		const pgmpvwDests = [
			{ label: 'PGM', actionId: 'select_pgm', bus: 'pgm', activeColor: RED },
			{ label: 'PVW', actionId: 'select_pvw', bus: 'pvw', activeColor: GREEN },
		]
		const sourceGroups = [
			{ name: 'HDMI', sources: HDMI_SOURCES },
			{ name: 'SDI', sources: SDI_SOURCES },
			{ name: 'Still', sources: STILL_SOURCES },
			{ name: 'XPT', sources: XPT_SOURCES },
		]

		const presets = {}
		const structure = []

		function addSection(id, name, ids) {
			structure.push({ id, name, definitions: ids })
		}

		function preset(name, text, bgcolor, actionId, actionOptions, feedbacks) {
			return {
				name,
				type: 'layered',
				elements: layeredBtn(text, bgcolor),
				steps: [{ down: [{ actionId, options: actionOptions }], up: [] }],
				feedbacks: feedbacks || [],
			}
		}

		// PGM / PVW presets
		for (const dest of pgmpvwDests) {
			for (const group of sourceGroups) {
				const sectionId = `${dest.label.toLowerCase()}_${group.name.toLowerCase()}`
				const sectionIds = []
				for (const src of group.sources) {
					const id = `${sectionId}_${src.pgmpvw_id}`
					const feedbacks = [
						{
							feedbackId: 'bus_tally',
							options: { bus: dest.bus, source: src.pgmpvw_id },
							styleOverrides: bgOverride(dest.activeColor),
						},
					]
					presets[id] = preset(
						`${dest.label}: ${src.label}`,
						src.label,
						DARK,
						dest.actionId,
						{ input: src.pgmpvw_id },
						feedbacks,
					)
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
						type: 'layered',
						elements: layeredBtn(src.label, DARK),
						steps: [
							{ down: [{ actionId: 'aux_assign', options: { aux: aux.aux_address, assign: src.pgmpvw_id } }], up: [] },
						],
						feedbacks: [
							{
								feedbackId: 'bus_tally',
								options: { bus: aux.bus, source: src.pgmpvw_id },
								styleOverrides: bgOverride(aux.color),
							},
						],
					}
					sectionIds.push(id)
				}
				addSection(sectionId, `${aux.label} - ${group.name}`, sectionIds)
			}
		}

		// PiP channel definitions
		const pipTargets = [
			{ id: '1B', n: 1 },
			{ id: '1C', n: 2 },
			{ id: '1D', n: 3 },
			{ id: '1E', n: 4 },
		]

		// PiP Capture / Apply
		const pipCapIds = []
		for (const p of pipTargets) {
			const capId = `capture_pip${p.n}`
			const applyId = `apply_pip${p.n}`
			presets[capId] = preset(`Capture PiP ${p.n}`, `CAPTURE\nPiP ${p.n}`, CYAN, 'capture_pinp', { pinp: p.id })
			presets[applyId] = preset(`Apply PiP ${p.n}`, `APPLY\nPiP ${p.n}`, PURPLE, 'apply_pinp', { pinp: p.id })
			pipCapIds.push(capId, applyId)
		}
		addSection('pip_capture_apply', 'PiP Capture / Apply', pipCapIds)

		// PiP Source presets (HDMI 1-8, SDI 1-8, Input 1-10)
		const pipSources = [
			...Array.from({ length: 8 }, (_, i) => ({
				label: `H${i + 1}`,
				id: i.toString(16).padStart(2, '0').toUpperCase(),
			})),
			...Array.from({ length: 8 }, (_, i) => ({
				label: `S${i + 1}`,
				id: (8 + i).toString(16).padStart(2, '0').toUpperCase(),
			})),
			...Array.from({ length: 10 }, (_, i) => ({
				label: `IN${i + 1}`,
				id: (0x20 + i).toString(16).padStart(2, '0').toUpperCase(),
			})),
		]
		for (const p of pipTargets) {
			const sectionId = `pip${p.n}_source`
			const sectionIds = []
			for (const src of pipSources) {
				const id = `${sectionId}_${src.id}`
				presets[id] = preset(`PiP ${p.n} Source: ${src.label}`, src.label, NAVY, 'pnpkey_setsource', {
					pinp: p.id,
					assign: src.id,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `PiP ${p.n} - Source`, sectionIds)
		}

		// PiP Type presets
		const pipTypes = [
			{ id: '00', label: 'PinP' },
			{ id: '01', label: 'Luma-W' },
			{ id: '02', label: 'Luma-B' },
			{ id: '03', label: 'Chroma' },
		]
		for (const p of pipTargets) {
			const sectionId = `pip${p.n}_type`
			const sectionIds = []
			for (const t of pipTypes) {
				const id = `${sectionId}_${t.id}`
				presets[id] = preset(`PiP ${p.n} Type: ${t.label}`, `PiP${p.n}\n${t.label}`, TEAL, 'pnpkey_settype', {
					pinp: p.id,
					type: t.id,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `PiP ${p.n} - Type`, sectionIds)
		}

		// PiP Shape presets
		const pipShapes = [
			{ id: '00', label: 'Rect' },
			{ id: '01', label: 'Circle' },
			{ id: '02', label: 'Diamond' },
		]
		for (const p of pipTargets) {
			const sectionId = `pip${p.n}_shape`
			const sectionIds = []
			for (const s of pipShapes) {
				const id = `${sectionId}_${s.id}`
				presets[id] = preset(`PiP ${p.n} Shape: ${s.label}`, `PiP${p.n}\n${s.label}`, TEAL, 'pnpkey_shape', {
					pinp: p.id,
					shape: s.id,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `PiP ${p.n} - Shape`, sectionIds)
		}

		// PiP Border Color presets
		const pipBorderColors = [
			{ id: '00', label: 'White' },
			{ id: '01', label: 'Yellow' },
			{ id: '02', label: 'Cyan' },
			{ id: '03', label: 'Green' },
			{ id: '04', label: 'Magenta' },
			{ id: '05', label: 'Red' },
			{ id: '06', label: 'Blue' },
			{ id: '07', label: 'Black' },
			{ id: '08', label: 'Custom' },
			{ id: '09', label: 'Soft Edge' },
		]
		for (const p of pipTargets) {
			const sectionId = `pip${p.n}_bordercolor`
			const sectionIds = []
			for (const c of pipBorderColors) {
				const id = `${sectionId}_${c.id}`
				presets[id] = preset(`PiP ${p.n} Border: ${c.label}`, `PiP${p.n}\n${c.label}`, DARK, 'pnpkey_borderColor', {
					pinp: p.id,
					color: c.id,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `PiP ${p.n} - Border Color`, sectionIds)
		}

		// DSK channel definitions
		const dskTargets = [
			{ id: '1F', n: 1 },
			{ id: '20', n: 2 },
		]

		// DSK Capture / Apply
		const dskCapIds = []
		for (const d of dskTargets) {
			const capId = `capture_dsk${d.n}`
			const applyId = `apply_dsk${d.n}`
			presets[capId] = preset(`Capture DSK ${d.n}`, `CAPTURE\nDSK ${d.n}`, CYAN, 'capture_dsk', { dsk: d.id })
			presets[applyId] = preset(`Apply DSK ${d.n}`, `APPLY\nDSK ${d.n}`, PURPLE, 'apply_dsk', { dsk: d.id })
			dskCapIds.push(capId, applyId)
		}
		addSection('dsk_capture_apply', 'DSK Capture / Apply', dskCapIds)

		// DSK source list: integer IDs matching CHOICES_INPUTSASSIGN (0-31)
		const dskSources = [
			...Array.from({ length: 8 }, (_, i) => ({ intId: i, label: `H${i + 1}` })),
			...Array.from({ length: 8 }, (_, i) => ({ intId: 8 + i, label: `S${i + 1}` })),
			...Array.from({ length: 16 }, (_, i) => ({ intId: 16 + i, label: `St${i + 1}` })),
		]

		const dskIntIds = [
			{ intId: 31, n: 1 },
			{ intId: 32, n: 2 },
		]

		for (const d of dskIntIds) {
			const sectionId = `dsk${d.n}_keysource`
			const sectionIds = []
			for (const src of dskSources) {
				const id = `${sectionId}_${src.intId}`
				presets[id] = preset(`DSK ${d.n} Key Src: ${src.label}`, src.label, NAVY, 'set_dsk_key_source', {
					dsk: d.intId,
					assign: src.intId,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `DSK ${d.n} - Key Source`, sectionIds)
		}

		for (const d of dskIntIds) {
			const sectionId = `dsk${d.n}_fillsource`
			const sectionIds = []
			for (const src of dskSources) {
				const id = `${sectionId}_${src.intId}`
				presets[id] = preset(`DSK ${d.n} Fill Src: ${src.label}`, src.label, NAVY, 'set_dsk_fill_source', {
					dsk: d.intId,
					assign: src.intId,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `DSK ${d.n} - Fill Source`, sectionIds)
		}

		// DSK Type presets
		const dskTypes = [
			{ id: 0, label: 'Luma-W' },
			{ id: 1, label: 'Luma-B' },
			{ id: 2, label: 'Chroma' },
		]
		for (const d of dskIntIds) {
			const sectionId = `dsk${d.n}_type`
			const sectionIds = []
			for (const t of dskTypes) {
				const id = `${sectionId}_${t.id}`
				presets[id] = preset(`DSK ${d.n} Type: ${t.label}`, `DSK${d.n}\n${t.label}`, TEAL, 'set_dsk_type', {
					dsk: d.intId,
					key: t.id,
				})
				sectionIds.push(id)
			}
			addSection(sectionId, `DSK ${d.n} - Type`, sectionIds)
		}

		// Snapshot presets — 5 named slots
		const SNAPSHOT_SLOTS = [
			{ name: 'snapshot1', label: 'Snap 1' },
			{ name: 'snapshot2', label: 'Snap 2' },
			{ name: 'snapshot3', label: 'Snap 3' },
			{ name: 'snapshot4', label: 'Snap 4' },
			{ name: 'snapshot5', label: 'Snap 5' },
		]

		const SAVE_DIM = combineRgb(60, 30, 0)
		const CLEAR_COLOR = combineRgb(120, 0, 0)

		const snapSaveIds = []
		for (const slot of SNAPSHOT_SLOTS) {
			const saveId = `snap_save_${slot.name}`
			const clearId = `snap_clear_${slot.name}`

			presets[saveId] = {
				name: `Save ${slot.label}`,
				type: 'layered',
				elements: layeredBtn(`SAVE\n${slot.label}`, SAVE_DIM),
				steps: [{ down: [{ actionId: 'save_snapshot', options: { name: slot.name } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'snapshot_exists',
						options: { name: slot.name },
						styleOverrides: bgOverride(SAVE_COLOR),
					},
				],
			}

			presets[clearId] = {
				name: `Clear ${slot.label}`,
				type: 'layered',
				elements: layeredBtn(`CLEAR\n${slot.label}`, SAVE_DIM),
				steps: [{ down: [{ actionId: 'delete_snapshot', options: { name: slot.name } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'snapshot_exists',
						options: { name: slot.name },
						styleOverrides: bgOverride(CLEAR_COLOR),
					},
				],
			}

			snapSaveIds.push(saveId, clearId)
		}
		addSection('snap_save', 'Snapshot - Save / Clear', snapSaveIds)

		for (const p of pipTargets) {
			const sectionId = `snap_load_pip${p.n}`
			const sectionIds = []
			for (const slot of SNAPSHOT_SLOTS) {
				const id = `${sectionId}_${slot.name}`
				presets[id] = preset(
					`Load ${slot.label} → PiP ${p.n}`,
					`${slot.label}\nPiP${p.n}`,
					LOAD_COLOR,
					'load_and_apply_pinp_snapshot',
					{ name: slot.name, pinp: p.id },
				)
				sectionIds.push(id)
			}
			addSection(sectionId, `Snapshot Load → PiP ${p.n}`, sectionIds)
		}

		for (const d of dskTargets) {
			const sectionId = `snap_load_dsk${d.n}`
			const sectionIds = []
			for (const slot of SNAPSHOT_SLOTS) {
				const id = `${sectionId}_${slot.name}`
				presets[id] = preset(
					`Load ${slot.label} → DSK ${d.n}`,
					`${slot.label}\nDSK${d.n}`,
					LOAD_COLOR,
					'load_and_apply_dsk_snapshot',
					{ name: slot.name, dsk: d.id },
				)
				sectionIds.push(id)
			}
			addSection(sectionId, `Snapshot Load → DSK ${d.n}`, sectionIds)
		}

		self.setPresetDefinitions(structure, presets)
	},
}
