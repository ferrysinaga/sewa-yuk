import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pemeriksa budget bundle setelah `vite build`.
 *
 * Baseline 11 November 2026 (Vite 8, build produksi):
 * - 32 chunk JS, total 789,63 kB, CSS 28,51 kB.
 * - Chunk terbesar: react 218,75 kB dan supabase 214,38 kB.
 * - Tidak ada chunk yang melewati ambang peringatan Vite 500 kB.
 *
 * Angka di bawah memberi ruang tumbuh yang wajar, tetapi tetap menangkap
 * dependensi besar yang tidak sengaja masuk ke chunk awal atau vendor.
 * Perbarui budget hanya dengan alasan yang jelas dan catat di PR.
 */
const BUDGET = {
  maxChunkKb: 500,
  maxTotalJsKb: 850,
  maxCssKb: 60,
  vendorChunks: {
    'react-router': 50,
    react: 260,
    supabase: 260,
    dnd: 60,
  },
}

const assetsDir = join(process.cwd(), 'dist', 'assets')

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`
}

function readAssets(extension) {
  return readdirSync(assetsDir)
    .filter((file) => file.endsWith(extension))
    .map((file) => {
      const path = join(assetsDir, file)
      return { file, bytes: statSync(path).size }
    })
    .sort((a, b) => b.bytes - a.bytes)
}

let assets
try {
  assets = readAssets('.js')
} catch {
  console.error('dist/assets tidak ditemukan. Jalankan `npm run build` terlebih dahulu.')
  process.exit(1)
}

const cssAssets = readAssets('.css')
const failures = []
const totalJsBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0)
const totalCssBytes = cssAssets.reduce((sum, asset) => sum + asset.bytes, 0)

console.log('Bundle budget check')
console.log(`  Total JS : ${formatKb(totalJsBytes)} (budget ${BUDGET.maxTotalJsKb} kB)`)
console.log(`  Total CSS: ${formatKb(totalCssBytes)} (budget ${BUDGET.maxCssKb} kB)`)
console.log('  Chunk terbesar:')

for (const asset of assets.slice(0, 8)) {
  console.log(`    ${asset.file.padEnd(40)} ${formatKb(asset.bytes)}`)
}

if (totalJsBytes > BUDGET.maxTotalJsKb * 1000) {
  failures.push(`Total JS ${formatKb(totalJsBytes)} melewati budget ${BUDGET.maxTotalJsKb} kB.`)
}

if (totalCssBytes > BUDGET.maxCssKb * 1000) {
  failures.push(`Total CSS ${formatKb(totalCssBytes)} melewati budget ${BUDGET.maxCssKb} kB.`)
}

for (const asset of assets) {
  if (asset.bytes > BUDGET.maxChunkKb * 1000) {
    failures.push(
      `${asset.file} ${formatKb(asset.bytes)} melewati ambang peringatan ${BUDGET.maxChunkKb} kB.`,
    )
  }
}

// Cocokkan nama chunk vendor tanpa hash, mis. `react-DCTAcUCH.js`.
for (const [vendor, budgetKb] of Object.entries(BUDGET.vendorChunks)) {
  const asset = assets.find((candidate) => candidate.file.startsWith(`${vendor}-`))

  if (asset && asset.bytes > budgetKb * 1000) {
    failures.push(`Chunk vendor ${vendor} ${formatKb(asset.bytes)} melewati budget ${budgetKb} kB.`)
  }
}

if (failures.length > 0) {
  console.error('\nBudget bundle terlampaui:')
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error(
    '\nPeriksa dependensi baru, hindari barrel file, atau pecah chunk sebelum menaikkan budget.',
  )
  process.exit(1)
}

console.log('\nSemua chunk berada dalam budget.')
