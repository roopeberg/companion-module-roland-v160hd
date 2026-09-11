/* eslint-disable n/no-process-exit */
/**
 * Restore device addresses from an originals snapshot produced by integration.js.
 *
 * Usage:
 *   node test/restore.js --host 192.168.x.x --password <pw> --file test/results/originals-<ts>.json
 *
 * Reads the JSON file, connects to the device, and sends DTH for every
 * address in the snapshot. Safe to run after a crashed integration test.
 */

const net = require('node:net')
const fs = require('node:fs')

const args = Object.fromEntries(
	process.argv.slice(2).reduce((acc, v, i, arr) => {
		if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] ?? true])
		return acc
	}, []),
)

const HOST = args.host
const PASSWORD = args.password
const PORT = Number(args.port ?? 8023)
const FILE = args.file

if (!HOST || !PASSWORD || !FILE) {
	console.error('Usage: node test/restore.js --host <ip> --password <pw> --file <originals.json>')
	process.exit(1)
}

const originals = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const entries = Object.entries(originals)

if (entries.length === 0) {
	console.log('Originals file is empty — nothing to restore.')
	process.exit(0)
}

console.log(`\nRestoring ${entries.length} address(es) to ${HOST}:${PORT}`)
console.log(`Source: ${FILE}\n`)

async function run() {
	const sock = net.createConnection({ host: HOST, port: PORT })
	sock.setEncoding('utf8')

	let buf = ''

	function waitFor(pattern, timeout = 6000) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${pattern}`)), timeout)
			function check() {
				if (pattern.test(buf)) {
					clearTimeout(timer)
					buf = ''
					resolve()
				}
			}
			sock.on('data', (chunk) => {
				buf += chunk
				check()
			})
			check()
		})
	}

	sock.on('error', (err) => {
		console.error('Socket error:', err.message)
		process.exit(1)
	})

	await waitFor(/Enter password:/)
	sock.write(PASSWORD + '\n')
	await waitFor(/Welcome to V-160HD/)
	console.log('Connected.\n')

	for (const [address, { value, label }] of entries) {
		sock.write(`DTH:${address},${value};`)
		console.log(`  ✅  ${address} = ${value}  (${label})`)
		await new Promise((r) => setTimeout(r, 150))
	}

	console.log('\nRestore complete.')
	sock.destroy()
}

run().catch((err) => {
	console.error(err.message)
	process.exit(1)
})
