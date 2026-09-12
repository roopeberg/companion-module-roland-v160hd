const { combineRgb } = require('@companion-module/base')

module.exports = {
	initPresets: function () {
		let self = this

		const WHITE = combineRgb(255, 255, 255)
		const BLACK = combineRgb(0, 0, 0)
		const RED = combineRgb(204, 0, 0)
		const GREEN = combineRgb(0, 180, 0)
		const AMBER = combineRgb(210, 120, 0)
		const CYAN_AUX = combineRgb(0, 160, 200)
		const VIOLET = combineRgb(160, 0, 192)
		const DARK = combineRgb(30, 30, 30)
		const CYAN = combineRgb(0, 160, 200)
		const PURPLE = combineRgb(120, 0, 180)
		const TEAL = combineRgb(0, 130, 120)
		const NAVY = combineRgb(20, 40, 100)
		const SAVE_COLOR = combineRgb(180, 80, 0)
		const LOAD_COLOR = combineRgb(0, 100, 180)

		// Source type accent colors (top bar)
		const TYPE_HDMI = combineRgb(42, 106, 219)
		const TYPE_SDI = combineRgb(212, 96, 0)
		const TYPE_STILL = combineRgb(128, 32, 200)
		const TYPE_XPT = combineRgb(0, 160, 128)

		// Dim versions of bus colors — visible hint when inactive
		const DIM_AMBER = combineRgb(45, 22, 0)
		const DIM_CYAN_AUX = combineRgb(0, 32, 42)
		const DIM_VIOLET = combineRgb(34, 0, 42)
		const DIM_RED = combineRgb(52, 5, 5)
		const DIM_GREEN = combineRgb(5, 42, 5)

		// Opacity for the black overlay that dims the bus-colour background.
		// 0 = fully transparent (active), 80 = mostly opaque (inactive dim glow).
		const OVERLAY_INACTIVE = 80
		const OVERLAY_ACTIVE = 0

		const FONT_SIZE = 30

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
			return [
				{
					elementId: 'bg',
					elementProperty: 'color',
					override: { isExpression: false, value: color },
				},
			]
		}

		function dotOverride(id, color) {
			return [
				{
					elementId: id,
					elementProperty: 'color',
					override: { isExpression: false, value: color },
				},
			]
		}

		function opacityOverride(id, opacity) {
			return [
				{
					elementId: id,
					elementProperty: 'opacity',
					override: { isExpression: false, value: opacity },
				},
			]
		}

		// Per-bus source button.
		// busColor: the full-brightness bus colour used as the background.
		// The black overlay dims it to a subtle glow when inactive.
		// Primary feedback removes the overlay (opacity → 0) to reveal the full colour.
		// Secondary indicators (circles, aux strips) start at dim colours and brighten via feedback.
		function sourceBtn(sourceLabel, busLabel, busLabelColor, typeColor, busColor) {
			return [
				// Full-brightness bus colour fills the button background.
				{
					type: 'box',
					id: 'bg',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					color: busColor,
				},
				// Black overlay dims the bg to a subtle glow when inactive.
				{
					type: 'box',
					id: 'overlay',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					color: BLACK,
					opacity: OVERLAY_INACTIVE,
				},
				// Source-type colour bar (above overlay — always fully visible).
				{
					type: 'box',
					id: 'type_bar',
					x: 0,
					y: 0,
					width: 100,
					height: 5,
					color: typeColor ?? DARK,
				},
				{
					type: 'text',
					id: 'bus_label',
					x: 4,
					y: 7,
					width: 68,
					height: 14,
					text: busLabel,
					fontsize: 14,
					fontsizeAllowShrink: true,
					color: busLabelColor,
					halign: 'left',
					valign: 'top',
				},
				// PGM / PVW tally circles — dim by default, brightened by secondary feedbacks.
				{
					type: 'circle',
					id: 'pgm_dot',
					x: 75,
					y: 6,
					width: 10,
					height: 10,
					color: DIM_RED,
				},
				{
					type: 'circle',
					id: 'pvw_dot',
					x: 87,
					y: 6,
					width: 10,
					height: 10,
					color: DIM_GREEN,
				},
				{
					type: 'text',
					id: 'label',
					x: 3,
					y: 20,
					width: 94,
					height: 65,
					text: sourceLabel,
					fontsize: FONT_SIZE,
					fontsizeAllowShrink: true,
					color: WHITE,
					halign: 'center',
					valign: 'center',
				},
				// AUX strips — dim bus colour by default, brightened by secondary feedbacks.
				{
					type: 'box',
					id: 'dot_aux1',
					x: 3,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_AMBER,
				},
				{
					type: 'box',
					id: 'dot_aux2',
					x: 35,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_CYAN_AUX,
				},
				{
					type: 'box',
					id: 'dot_aux3',
					x: 67,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_VIOLET,
				},
			]
		}

		// Multi-tally source button: shows PGM/PVW/AUX1-3 state on one button.
		// PGM/PVW each have their own full-size colour layer (opacity 0 by default)
		// that the feedback reveals.  AUX strips start at dim colour.
		function sourceBtnMultiTally(sourceLabel, typeColor) {
			return [
				// Base background (dark).
				{
					type: 'box',
					id: 'bg',
					x: 0,
					y: 5,
					width: 100,
					height: 95,
					color: DARK,
				},
				// PGM colour layer — revealed by PGM feedback (opacity: 0 → 100).
				{
					type: 'box',
					id: 'pgm_bg',
					x: 0,
					y: 5,
					width: 100,
					height: 95,
					color: RED,
					opacity: 0,
				},
				// PVW colour layer — revealed by PVW feedback (opacity: 0 → 100).
				{
					type: 'box',
					id: 'pvw_bg',
					x: 0,
					y: 5,
					width: 100,
					height: 95,
					color: GREEN,
					opacity: 0,
				},
				// Source-type colour bar (always visible).
				{
					type: 'box',
					id: 'type_bar',
					x: 0,
					y: 0,
					width: 100,
					height: 5,
					color: typeColor ?? DARK,
				},
				// PGM / PVW tally circles.
				{
					type: 'circle',
					id: 'pgm_c',
					x: 75,
					y: 6,
					width: 10,
					height: 10,
					color: DIM_RED,
				},
				{
					type: 'circle',
					id: 'pvw_c',
					x: 87,
					y: 6,
					width: 10,
					height: 10,
					color: DIM_GREEN,
				},
				{
					type: 'text',
					id: 'label',
					x: 3,
					y: 20,
					width: 94,
					height: 65,
					text: sourceLabel,
					fontsize: FONT_SIZE,
					fontsizeAllowShrink: true,
					color: WHITE,
					halign: 'center',
					valign: 'center',
				},
				// AUX strips — dim colour by default, brightened when active.
				{
					type: 'box',
					id: 'dot_aux1',
					x: 3,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_AMBER,
				},
				{
					type: 'box',
					id: 'dot_aux2',
					x: 35,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_CYAN_AUX,
				},
				{
					type: 'box',
					id: 'dot_aux3',
					x: 67,
					y: 87,
					width: 29,
					height: 10,
					color: DIM_VIOLET,
				},
			]
		}

		// Source groups
		const HDMI_SOURCES = Array.from({ length: 8 }, (_, i) => ({
			label: `HDMI ${i + 1}`,
			pgmpvw_id: i.toString(16).padStart(2, '0').toUpperCase(),
			tally_id: i,
			typeColor: TYPE_HDMI,
		}))
		const SDI_SOURCES = Array.from({ length: 8 }, (_, i) => ({
			label: `SDI ${i + 1}`,
			pgmpvw_id: (8 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: 8 + i,
			typeColor: TYPE_SDI,
		}))
		const STILL_SOURCES = Array.from({ length: 16 }, (_, i) => ({
			label: `Still ${i + 1}`,
			pgmpvw_id: (0x10 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: null,
			typeColor: TYPE_STILL,
		}))
		const XPT_SOURCES = Array.from({ length: 10 }, (_, i) => ({
			label: `INPUT ${i + 1}`,
			pgmpvw_id: (0x20 + i).toString(16).padStart(2, '0').toUpperCase(),
			tally_id: 32 + i,
			typeColor: TYPE_XPT,
		}))

		const PGM_LABEL_COLOR = combineRgb(120, 0, 0)
		const PVW_LABEL_COLOR = combineRgb(0, 100, 0)
		const AUX1_LABEL_COLOR = combineRgb(90, 50, 0)
		const AUX2_LABEL_COLOR = combineRgb(0, 70, 90)
		const AUX3_LABEL_COLOR = combineRgb(70, 0, 100)

		const AUX_DESTS = [
			{
				label: 'AUX 1',
				aux_address: '000011',
				bus: 'aux1',
				labelColor: AUX1_LABEL_COLOR,
				activeColor: AMBER,
			},
			{
				label: 'AUX 2',
				aux_address: '00002E',
				bus: 'aux2',
				labelColor: AUX2_LABEL_COLOR,
				activeColor: CYAN_AUX,
			},
			{
				label: 'AUX 3',
				aux_address: '00002F',
				bus: 'aux3',
				labelColor: AUX3_LABEL_COLOR,
				activeColor: VIOLET,
			},
		]
		const pgmpvwDests = [
			{
				label: 'PGM',
				actionId: 'select_pgm',
				bus: 'pgm',
				labelColor: PGM_LABEL_COLOR,
				activeColor: RED,
			},
			{
				label: 'PVW',
				actionId: 'select_pvw',
				bus: 'pvw',
				labelColor: PVW_LABEL_COLOR,
				activeColor: GREEN,
			},
		]

		// Primary feedback for per-bus source buttons: removes the black overlay to
		// reveal the full bus-colour background.
		function primaryOverlayFeedback(bus, source) {
			return {
				feedbackId: 'bus_tally',
				options: { bus, source },
				styleOverrides: opacityOverride('overlay', OVERLAY_ACTIVE),
			}
		}

		// Secondary tally feedbacks for per-bus source buttons.
		// Updates circles (pgm_dot / pvw_dot) and AUX strips from dim to full brightness.
		// primaryBus is excluded since it drives the overlay instead.
		function secondaryFeedbacks(source, primaryBus) {
			const all = [
				{ bus: 'pgm', elementId: 'pgm_dot', color: RED },
				{ bus: 'pvw', elementId: 'pvw_dot', color: GREEN },
				{ bus: 'aux1', elementId: 'dot_aux1', color: AMBER },
				{ bus: 'aux2', elementId: 'dot_aux2', color: CYAN_AUX },
				{ bus: 'aux3', elementId: 'dot_aux3', color: VIOLET },
			]
			return all
				.filter((b) => b.bus !== primaryBus)
				.map((b) => ({
					feedbackId: 'bus_tally',
					options: { bus: b.bus, source },
					styleOverrides: dotOverride(b.elementId, b.color),
				}))
		}

		// Multi-tally feedbacks: PGM/PVW reveal their colour layer; AUX lights strips.
		function multiTallyFeedbacks(source) {
			return [
				{
					feedbackId: 'bus_tally',
					options: { bus: 'pgm', source },
					styleOverrides: [
						// Reveal PGM red layer and show PGM circle bright.
						...opacityOverride('pgm_bg', 100),
						...dotOverride('pgm_c', WHITE),
					],
				},
				{
					feedbackId: 'bus_tally',
					options: { bus: 'pvw', source },
					styleOverrides: [
						// Reveal PVW green layer (on top of PGM layer) and show PVW circle bright.
						...opacityOverride('pvw_bg', 100),
						...dotOverride('pvw_c', WHITE),
					],
				},
				{
					feedbackId: 'bus_tally',
					options: { bus: 'aux1', source },
					styleOverrides: dotOverride('dot_aux1', AMBER),
				},
				{
					feedbackId: 'bus_tally',
					options: { bus: 'aux2', source },
					styleOverrides: dotOverride('dot_aux2', CYAN_AUX),
				},
				{
					feedbackId: 'bus_tally',
					options: { bus: 'aux3', source },
					styleOverrides: dotOverride('dot_aux3', VIOLET),
				},
			]
		}

		// PGM Multi-AUX source buttons — alternate PGM layout with AUX squares in bottom third.
		function pgmMultiAuxBtn(sourceLabel) {
			return [
				{
					type: 'box',
					id: 'bg',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					color: DARK,
				},
				{
					type: 'text',
					id: 'label',
					x: 3,
					y: 3,
					width: 94,
					height: 61,
					text: sourceLabel,
					fontsize: FONT_SIZE,
					fontsizeAllowShrink: true,
					color: WHITE,
					halign: 'center',
					valign: 'center',
				},
				{
					type: 'box',
					id: 'dot_aux1',
					x: 0,
					y: 67,
					width: 33,
					height: 33,
					color: DARK,
				},
				{
					type: 'box',
					id: 'dot_aux2',
					x: 33,
					y: 67,
					width: 34,
					height: 33,
					color: DARK,
				},
				{
					type: 'box',
					id: 'dot_aux3',
					x: 67,
					y: 67,
					width: 33,
					height: 33,
					color: DARK,
				},
				{
					type: 'text',
					id: 'num1',
					x: 0,
					y: 67,
					width: 33,
					height: 33,
					text: '1',
					fontsize: 22,
					fontsizeAllowShrink: false,
					color: DARK,
					halign: 'center',
					valign: 'center',
				},
				{
					type: 'text',
					id: 'num2',
					x: 33,
					y: 67,
					width: 34,
					height: 33,
					text: '2',
					fontsize: 22,
					fontsizeAllowShrink: false,
					color: DARK,
					halign: 'center',
					valign: 'center',
				},
				{
					type: 'text',
					id: 'num3',
					x: 67,
					y: 67,
					width: 33,
					height: 33,
					text: '3',
					fontsize: 22,
					fontsizeAllowShrink: false,
					color: DARK,
					halign: 'center',
					valign: 'center',
				},
			]
		}

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
					presets[id] = {
						name: `${dest.label}: ${src.label}`,
						type: 'layered',
						elements: sourceBtn(src.label, dest.label, dest.labelColor, src.typeColor, dest.activeColor),
						steps: [
							{
								down: [
									{
										actionId: dest.actionId,
										options: { input: src.pgmpvw_id },
									},
								],
								up: [],
							},
						],
						feedbacks: [
							primaryOverlayFeedback(dest.bus, src.pgmpvw_id),
							...secondaryFeedbacks(src.pgmpvw_id, dest.bus),
						],
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
						type: 'layered',
						elements: sourceBtn(src.label, aux.label, aux.labelColor, src.typeColor, aux.activeColor),
						steps: [
							{
								down: [
									{
										actionId: 'aux_assign',
										options: { aux: aux.aux_address, assign: src.pgmpvw_id },
									},
								],
								up: [],
							},
						],
						feedbacks: [
							primaryOverlayFeedback(aux.bus, src.pgmpvw_id),
							...secondaryFeedbacks(src.pgmpvw_id, aux.bus),
						],
					}
					sectionIds.push(id)
				}
				addSection(sectionId, `${aux.label} - ${group.name}`, sectionIds)
			}
		}

		// Multi-tally source buttons — one button per source, shows PGM/PVW/AUX1-3 state.
		// Press selects PGM.
		for (const group of sourceGroups) {
			const sectionId = `mt_${group.name.toLowerCase()}`
			const sectionIds = []
			for (const src of group.sources) {
				const id = `${sectionId}_${src.pgmpvw_id}`
				presets[id] = {
					name: `Multi-tally: ${src.label}`,
					type: 'layered',
					elements: sourceBtnMultiTally(src.label, src.typeColor),
					steps: [
						{
							down: [{ actionId: 'select_pgm', options: { input: src.pgmpvw_id } }],
							up: [],
						},
					],
					feedbacks: multiTallyFeedbacks(src.pgmpvw_id),
				}
				sectionIds.push(id)
			}
			addSection(sectionId, `Multi-tally — ${group.name}`, sectionIds)
		}

		// PGM Multi-AUX source buttons
		for (const group of sourceGroups) {
			const sectionId = `pgm_aux_${group.name.toLowerCase()}`
			const sectionIds = []
			for (const src of group.sources) {
				const id = `${sectionId}_${src.pgmpvw_id}`
				presets[id] = {
					name: `PGM+AUX: ${src.label}`,
					type: 'layered',
					elements: pgmMultiAuxBtn(src.label),
					steps: [
						{
							down: [{ actionId: 'select_pgm', options: { input: src.pgmpvw_id } }],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'bus_tally',
							options: { bus: 'pgm', source: src.pgmpvw_id },
							styleOverrides: bgOverride(RED),
						},
						{
							feedbackId: 'bus_tally',
							options: { bus: 'aux1', source: src.pgmpvw_id },
							styleOverrides: [
								...dotOverride('dot_aux1', AMBER),
								{
									elementId: 'num1',
									elementProperty: 'color',
									override: { isExpression: false, value: WHITE },
								},
							],
						},
						{
							feedbackId: 'bus_tally',
							options: { bus: 'aux2', source: src.pgmpvw_id },
							styleOverrides: [
								...dotOverride('dot_aux2', CYAN_AUX),
								{
									elementId: 'num2',
									elementProperty: 'color',
									override: { isExpression: false, value: WHITE },
								},
							],
						},
						{
							feedbackId: 'bus_tally',
							options: { bus: 'aux3', source: src.pgmpvw_id },
							styleOverrides: [
								...dotOverride('dot_aux3', VIOLET),
								{
									elementId: 'num3',
									elementProperty: 'color',
									override: { isExpression: false, value: WHITE },
								},
							],
						},
					],
				}
				sectionIds.push(id)
			}
			addSection(sectionId, `PGM+AUX — ${group.name}`, sectionIds)
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
					source: src.id,
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

		const dskSources = [
			...Array.from({ length: 8 }, (_, i) => ({
				intId: i,
				label: `H${i + 1}`,
			})),
			...Array.from({ length: 8 }, (_, i) => ({
				intId: 8 + i,
				label: `S${i + 1}`,
			})),
			...Array.from({ length: 16 }, (_, i) => ({
				intId: 16 + i,
				label: `St${i + 1}`,
			})),
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
				steps: [
					{
						down: [{ actionId: 'save_snapshot', options: { name: slot.name } }],
						up: [],
					},
				],
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
				steps: [
					{
						down: [{ actionId: 'delete_snapshot', options: { name: slot.name } }],
						up: [],
					},
				],
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

		// ── Freeze ──────────────────────────────────────────────────────────────

		const FREEZE_DIM = combineRgb(20, 40, 60)
		const FREEZE_ON = combineRgb(0, 100, 200)
		const FREEZE_CYAN = combineRgb(0, 180, 200)
		const FREEZE_TYPE_COLOR = combineRgb(80, 0, 140)

		presets['freeze_toggle'] = {
			name: 'Freeze On/Off',
			type: 'layered',
			elements: layeredBtn('FREEZE\nOFF', FREEZE_DIM),
			steps: [
				{
					down: [{ actionId: 'freezeSwitchOn', options: {} }],
					up: [],
				},
				{
					down: [{ actionId: 'freezeSwitchOff', options: {} }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'freeze',
					styleOverrides: bgOverride(FREEZE_ON),
				},
			],
		}

		presets['freeze_type'] = {
			name: 'Freeze Type',
			type: 'layered',
			elements: layeredBtn('FREEZE\nALL', FREEZE_DIM),
			steps: [
				{
					down: [{ actionId: 'freezeSwitchType', options: { type: '01' } }],
					up: [],
				},
				{
					down: [{ actionId: 'freezeSwitchType', options: { type: '00' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'freeze_type_select',
					styleOverrides: [
						{
							elementId: 'bg',
							elementProperty: 'color',
							override: { isExpression: false, value: FREEZE_TYPE_COLOR },
						},
						{
							elementId: 'label',
							elementProperty: 'text',
							override: { isExpression: false, value: 'FREEZE\nSELECT' },
						},
					],
				},
			],
		}

		presets['freeze_set_mode'] = {
			name: 'Set Freeze (modifier)',
			type: 'layered',
			elements: layeredBtn('SET\nFREEZE', FREEZE_DIM),
			steps: [
				{
					down: [{ actionId: 'freezeSelectModeEnable', options: {} }],
					up: [{ actionId: 'freezeSelectModeDisable', options: {} }],
				},
			],
			feedbacks: [
				{
					feedbackId: 'freeze_select_mode_active',
					styleOverrides: bgOverride(FREEZE_CYAN),
				},
			],
		}

		addSection('freeze_controls', 'Freeze Controls', ['freeze_toggle', 'freeze_type', 'freeze_set_mode'])

		const freezeInputGroups = [
			{
				name: 'HDMI',
				inputs: Array.from({ length: 8 }, (_, i) => ({
					label: `HDMI ${i + 1}`,
					pvw_id: i.toString(16).padStart(2, '0').toUpperCase(),
					freeze_addr: (i + 2).toString(16).padStart(2, '0').toUpperCase(),
				})),
			},
			{
				name: 'SDI',
				inputs: Array.from({ length: 8 }, (_, i) => ({
					label: `SDI ${i + 1}`,
					pvw_id: (8 + i).toString(16).padStart(2, '0').toUpperCase(),
					freeze_addr: (i + 0x0a).toString(16).padStart(2, '0').toUpperCase(),
				})),
			},
		]

		for (const group of freezeInputGroups) {
			const sectionId = `freeze_select_${group.name.toLowerCase()}`
			const sectionIds = []
			for (const inp of group.inputs) {
				const id = `${sectionId}_${inp.freeze_addr}`
				presets[id] = {
					name: `Freeze Select / PVW: ${inp.label}`,
					type: 'layered',
					elements: [
						{
							type: 'box',
							id: 'border',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							color: FREEZE_DIM,
						},
						{
							type: 'box',
							id: 'bg',
							x: 3,
							y: 3,
							width: 94,
							height: 83,
							color: FREEZE_DIM,
						},
						{
							type: 'box',
							id: 'pvw_dot',
							x: 83,
							y: 5,
							width: 12,
							height: 12,
							color: FREEZE_DIM,
						},
						{
							type: 'text',
							id: 'label',
							x: 3,
							y: 5,
							width: 78,
							height: 79,
							text: inp.label,
							fontsize: FONT_SIZE,
							fontsizeAllowShrink: true,
							color: WHITE,
							halign: 'center',
							valign: 'center',
						},
						{
							type: 'box',
							id: 'set_mode_bar',
							x: 3,
							y: 88,
							width: 94,
							height: 9,
							color: FREEZE_DIM,
						},
					],
					steps: [
						{
							down: [
								{
									actionId: 'pvwOrFreezeToggle',
									options: { input: inp.pvw_id, freeze_addr: inp.freeze_addr },
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'bus_tally',
							options: { bus: 'pvw', source: inp.pvw_id },
							styleOverrides: dotOverride('pvw_dot', GREEN),
						},
						{
							feedbackId: 'freeze_input_selected',
							options: { input: inp.freeze_addr },
							styleOverrides: [
								{
									elementId: 'border',
									elementProperty: 'color',
									override: { isExpression: false, value: FREEZE_CYAN },
								},
								{
									elementId: 'label',
									elementProperty: 'text',
									override: { isExpression: false, value: `❄ ${inp.label}` },
								},
							],
						},
						{
							feedbackId: 'freeze_select_mode_active',
							styleOverrides: dotOverride('set_mode_bar', FREEZE_CYAN),
						},
					],
				}
				sectionIds.push(id)
			}
			addSection(sectionId, `Freeze Select — ${group.name}`, sectionIds)
		}

		// ── Memory slots ────────────────────────────────────────────────────────

		const MEM_DIM = combineRgb(20, 20, 50)
		const MEM_ACTIVE = combineRgb(180, 80, 0)

		const loadIds = []
		const saveIds = []

		for (let slot = 1; slot <= 30; slot++) {
			const memId = slot - 1
			const nameVar = `$(roland-v160hd:memoryname_${slot})`

			const loadId = `memory_load_${slot}`
			presets[loadId] = {
				name: `Load Memory ${slot}`,
				type: 'layered',
				elements: [
					{
						type: 'box',
						id: 'bg',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: MEM_DIM,
					},
					{
						type: 'text',
						id: 'num',
						x: 0,
						y: 0,
						width: 30,
						height: 30,
						text: String(slot),
						fontsize: 18,
						fontsizeAllowShrink: false,
						color: WHITE,
						halign: 'left',
						valign: 'top',
					},
					{
						type: 'text',
						id: 'label',
						x: 0,
						y: 30,
						width: 100,
						height: 70,
						text: nameVar,
						fontsize: FONT_SIZE,
						fontsizeAllowShrink: true,
						color: WHITE,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: [
					{
						down: [{ actionId: 'load_memory_trigger', options: { memory: memId } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'memory_active',
						options: { slot },
						styleOverrides: bgOverride(MEM_ACTIVE),
					},
				],
			}
			loadIds.push(loadId)

			const saveId = `memory_save_${slot}`
			presets[saveId] = {
				name: `Save Memory ${slot}`,
				type: 'layered',
				elements: [
					{
						type: 'box',
						id: 'bg',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: MEM_DIM,
					},
					{
						type: 'text',
						id: 'num',
						x: 0,
						y: 0,
						width: 30,
						height: 30,
						text: String(slot),
						fontsize: 18,
						fontsizeAllowShrink: false,
						color: WHITE,
						halign: 'left',
						valign: 'top',
					},
					{
						type: 'text',
						id: 'label',
						x: 0,
						y: 30,
						width: 100,
						height: 70,
						text: nameVar,
						fontsize: FONT_SIZE,
						fontsizeAllowShrink: true,
						color: WHITE,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: [
					{
						down: [{ actionId: 'save_memory_trigger', options: { memory: memId } }],
						up: [],
					},
				],
				feedbacks: [],
			}
			saveIds.push(saveId)
		}

		addSection('memory_load', 'Memory Load', loadIds)
		addSection('memory_save', 'Memory Save', saveIds)

		// ── AUX mute ────────────────────────────────────────────────────────────

		const MUTE_ON = combineRgb(180, 30, 0)
		const MUTE_DIM = combineRgb(50, 10, 0)

		const AUX_MUTE_DESTS = [
			{ label: 'AUX 1', address: '012203', fbKey: 'aux1' },
			{ label: 'AUX 2', address: '012503', fbKey: 'aux2' },
			{ label: 'AUX 3', address: '012603', fbKey: 'aux3' },
		]

		const muteIds = []
		for (const aux of AUX_MUTE_DESTS) {
			for (const mute of [
				{ label: 'Mute', value: '01', color: MUTE_DIM },
				{ label: 'Unmute', value: '00', color: MUTE_DIM },
			]) {
				const id = `aux_mute_${aux.address}_${mute.value}`
				presets[id] = {
					name: `${aux.label} ${mute.label}`,
					type: 'layered',
					elements: layeredBtn(`${aux.label}\n${mute.label}`, MUTE_DIM),
					steps: [
						{
							down: [
								{
									actionId: 'aux_mute',
									options: { aux: aux.address, mute: mute.value },
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'auxMute',
							options: { aux: aux.fbKey, mute: mute.value },
							styleOverrides: bgOverride(MUTE_ON),
						},
					],
				}
				muteIds.push(id)
			}
		}
		addSection('aux_mute', 'AUX Mute', muteIds)

		// ── Transition type ──────────────────────────────────────────────────────

		const TRANS_COLOR = combineRgb(0, 80, 160)
		const TRANS_DIM = combineRgb(0, 25, 50)

		const transTypeIds = []
		for (const t of self.CHOICES_TRANSITION_TYPES) {
			const id = `transition_type_${t.id}`
			presets[id] = {
				name: `Transition: ${t.label}`,
				type: 'layered',
				elements: layeredBtn(t.label, TRANS_DIM),
				steps: [
					{
						down: [{ actionId: 'set_transition_type', options: { type: t.id } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'transition_type',
						options: { type: t.id },
						styleOverrides: bgOverride(TRANS_COLOR),
					},
				],
			}
			transTypeIds.push(id)
		}
		addSection('transition_type', 'Transition Type', transTypeIds)

		const mixTypeIds = []
		for (const t of self.CHOICES_MIX_TYPES) {
			const id = `mix_type_${t.id}`
			presets[id] = {
				name: `Mix Type: ${t.label}`,
				type: 'layered',
				elements: layeredBtn(`Mix\n${t.label}`, TRANS_DIM),
				steps: [
					{
						down: [{ actionId: 'set_mix_type', options: { type: t.id } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'mix_type',
						options: { type: t.id },
						styleOverrides: bgOverride(TRANS_COLOR),
					},
				],
			}
			mixTypeIds.push(id)
		}
		addSection('mix_type', 'Mix Type', mixTypeIds)

		const wipeTypeIds = []
		for (const t of self.CHOICES_WIPE_TYPES) {
			const id = `wipe_type_${t.id}`
			presets[id] = {
				name: `Wipe: ${t.label}`,
				type: 'layered',
				elements: layeredBtn(`Wipe\n${t.label}`, TRANS_DIM),
				steps: [
					{
						down: [{ actionId: 'set_wipe_type', options: { type: t.id } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'wipe_type',
						options: { type: t.id },
						styleOverrides: bgOverride(TRANS_COLOR),
					},
				],
			}
			wipeTypeIds.push(id)
		}
		addSection('wipe_type', 'Wipe Type', wipeTypeIds)

		const wipeDirIds = []
		for (const d of self.CHOICES_WIPE_DIRECTIONS) {
			const id = `wipe_dir_${d.id}`
			presets[id] = {
				name: `Wipe Direction: ${d.label}`,
				type: 'layered',
				elements: layeredBtn(`Wipe\n${d.label}`, TRANS_DIM),
				steps: [
					{
						down: [{ actionId: 'set_wipe_direction', options: { direction: d.id } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'wipe_direction',
						options: { direction: d.id },
						styleOverrides: bgOverride(TRANS_COLOR),
					},
				],
			}
			wipeDirIds.push(id)
		}
		addSection('wipe_direction', 'Wipe Direction', wipeDirIds)

		self.setPresetDefinitions(structure, presets)
	},
}
