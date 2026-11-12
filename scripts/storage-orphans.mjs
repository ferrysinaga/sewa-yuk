import { Buffer } from 'node:buffer'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Pembersih objek yatim di bucket blueprint-assets (BE-05).
 *
 * Skrip ini memakai Storage API, bukan `delete from storage.objects`, karena
 * menghapus baris metadata lewat SQL tidak menghapus file di backend Storage.
 *
 * Kebutuhan environment (jangan pernah commit nilainya):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Contoh:
 *   node scripts/storage-orphans.mjs --older-than-hours=24
 *   node scripts/storage-orphans.mjs --older-than-hours=24 --delete
 */

const BUCKET = 'blueprint-assets'
const PAGE_SIZE = 100
const DELETE_BATCH_SIZE = 100
const DEFAULT_OLDER_THAN_HOURS = 24

function printHelp() {
  console.log(`Pembersih objek yatim bucket ${BUCKET}.

Pemakaian:
  node scripts/storage-orphans.mjs [opsi]

Opsi:
  --older-than-hours=<n>  Hanya objek yang lebih tua dari n jam (default 24).
  --delete                Hapus objek yatim. Tanpa opsi ini hanya dry-run.
  --help, -h              Tampilkan bantuan.

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   Harus service role, bukan anon key.
`)
}

export function parseArgs(argv) {
  const options = {
    delete: false,
    olderThanHours: DEFAULT_OLDER_THAN_HOURS,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--delete') {
      options.delete = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg.startsWith('--older-than-hours=')) {
      const value = Number(arg.slice('--older-than-hours='.length))
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--older-than-hours harus angka >= 0.')
      }
      options.olderThanHours = value
    } else {
      throw new Error(`Argumen tidak dikenal: ${arg}`)
    }
  }

  return options
}

export function getJwtRole(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    )
    return JSON.parse(payload).role ?? null
  } catch {
    return null
  }
}

function assertServiceRole(key) {
  // Kunci baru Supabase memakai prefix sb_secret_. Kunci legacy berupa JWT
  // dengan klaim role service_role.
  if (key.startsWith('sb_secret_')) return

  if (getJwtRole(key) !== 'service_role') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY bukan service role. Jangan memakai anon key untuk pembersihan.',
    )
  }
}

async function listObjects(client, prefix = '', acc = []) {
  let offset = 0

  for (;;) {
    const { data, error } = await client.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      throw new Error(`Gagal membaca folder "${prefix || '/'}": ${error.message}`)
    }

    if (!data || data.length === 0) return acc

    for (const entry of data) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.id === null || entry.metadata === null) {
        await listObjects(client, name, acc)
      } else {
        acc.push({
          name,
          createdAt: entry.created_at,
          size: Number(entry.metadata?.size ?? 0),
        })
      }
    }

    if (data.length < PAGE_SIZE) return acc
    offset += data.length
  }
}

async function loadReferencedPaths(client) {
  const paths = new Set()
  let from = 0

  for (;;) {
    const { data, error } = await client
      .from('blueprints')
      .select('image_path')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Gagal membaca blueprints.image_path: ${error.message}`)
    }

    if (!data || data.length === 0) break

    for (const row of data) {
      const path = typeof row.image_path === 'string' ? row.image_path.trim() : ''
      if (path) paths.add(path)
    }

    if (data.length < PAGE_SIZE) break
    from += data.length
  }

  return paths
}

export function selectOrphans(objects, referencedPaths, cutoffMs) {
  return objects.filter(
    (object) =>
      !referencedPaths.has(object.name) &&
      Number.isFinite(Date.parse(object.createdAt)) &&
      Date.parse(object.createdAt) <= cutoffMs,
  )
}

async function removeInBatches(client, paths) {
  for (let index = 0; index < paths.length; index += DELETE_BATCH_SIZE) {
    const batch = paths.slice(index, index + DELETE_BATCH_SIZE)
    const { data, error } = await client.storage.from(BUCKET).remove(batch)

    if (error) {
      throw new Error(`Gagal menghapus batch ke-${index / DELETE_BATCH_SIZE + 1}: ${error.message}`)
    }

    console.log(`Dihapus ${data?.length ?? 0} objek.`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.')
    process.exitCode = 1
    return
  }

  assertServiceRole(key)

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`Bucket: ${BUCKET}`)

  const objects = await listObjects(client)
  const referencedPaths = await loadReferencedPaths(client)
  const cutoffMs = Date.now() - options.olderThanHours * 60 * 60 * 1000
  const orphans = selectOrphans(objects, referencedPaths, cutoffMs)
  const bytes = orphans.reduce((total, object) => total + object.size, 0)

  console.log(
    `Objek: ${objects.length}; referensi: ${referencedPaths.size}; yatim: ${orphans.length} (${bytes} byte).`,
  )

  for (const object of orphans.slice(0, 50)) {
    console.log(`  ${object.createdAt}  ${object.name}`)
  }

  if (orphans.length > 50) {
    console.log(`  ... dan ${orphans.length - 50} objek lain.`)
  }

  if (!options.delete) {
    console.log('Mode dry-run. Tambahkan --delete untuk menghapus objek di atas.')
    return
  }

  if (orphans.length === 0) {
    console.log('Tidak ada objek yatim yang perlu dihapus.')
    return
  }

  await removeInBatches(
    client,
    orphans.map((object) => object.name),
  )
  console.log('Pembersihan selesai.')
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
