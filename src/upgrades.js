const { EmptyUpgradeScript } = require('@companion-module/base')

module.exports = [
	// v0 — placeholder
	EmptyUpgradeScript,
	// v1 — migrate plaintext password config field to secrets
	function (_context, props) {
		const config = props.config ?? {}
		if (config.password === undefined) {
			return { updatedConfig: null, updatedSecrets: null, updatedActions: [], updatedFeedbacks: [] }
		}
		return {
			updatedConfig: { ...config, password: undefined },
			updatedSecrets: { password: config.password },
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
