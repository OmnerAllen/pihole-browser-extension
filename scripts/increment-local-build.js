const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'local-build-version.json')
let n = 0
try {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (typeof j.build === 'number' && Number.isFinite(j.build)) {
    n = j.build
  }
} catch {
  // missing or invalid — start from 0, then increment to 1
}
n += 1
fs.writeFileSync(file, `${JSON.stringify({ build: n }, null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`Local build: v${n}`)
