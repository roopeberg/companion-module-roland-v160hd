module.exports = [
	// v0 — placeholder
	function (_context, _props) {
		return {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
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
