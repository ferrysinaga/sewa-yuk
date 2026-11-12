import { Buffer } from 'node:buffer'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * Backfill role organizer ke app_metadata (BE-07).
 *
 * app_metadata hanya dapat diubah lewat service role/Admin API. Skrip ini
 * sengaja memakai allowlist email/UUID, bukan menyalin user_metadata.role,
 * karena nilai user_metadata dapat dieskalasi sendiri oleh pengguna (F1).
 *
 * Kebutuhan environment (jangan pernah commit nilainya):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Contoh:
 *   node scripts/backfill-roles.mjs --organizer-emails=organizer@example.com
 *   node scripts/backfill-roles.mjs --organizer-emails=organizer@example.com --apply
 */

const DEFAULT_PER_PAGE = 1000

function printHelp() {
  console.log(`Backfill role organizer ke app_metadata.

Pemakaian:
  node scripts/backfill-roles.mjs --organizer-emails=<email,...> [opsi]
  node scripts/backfill-roles.mjs --organizer-ids=<uuid,...> [opsi]

Opsi:
  --organizer-emails=<list>  Daftar email organizer dipisah koma.
  --organizer-ids=<list>     Daftar UUID organizer dipisah koma.
  --apply                    Tulis perubahan. Tanpa opsi ini hanya dry-run.
  --help, -h                 Tampilkan bantuan.

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   Harus service role, bukan anon key.

Catatan:
  - Hanya akun dalam allowlist yang diubah.
  - Jangan menyalin user_metadata.role; nilai itu tidak dapat dipercaya.
  - Setelah apply, pengguna harus logout/login agar JWT memuat app_metadata baru.
`)
}

export function parseArgs(argv) {
  const options = {
    apply: false,
    emails: [],
    ids: [],
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg.startsWith('--organizer-emails=')) {
      options.emails = splitList(arg.slice('--organizer-emails='.length)).map((email) =>
        email.toLowerCase(),
      )
    } else if (arg.startsWith('--organizer-ids=')) {
      options.ids = splitList(arg.slice('--organizer-ids='.length))
    } else {
      throw new Error(`Argumen tidak dikenal: ${arg}`)
    }
  }

  if (!options.help && options.emails.length === 0 && options.ids.length === 0) {
    throw new Error('Isi minimal satu --organizer-emails atau --organizer-ids.')
  }

  return options
}

function splitList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
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
  if (key.startsWith('sb_secret_')) return

  if (getJwtRole(key) !== 'service_role') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY bukan service role. Jangan memakai anon key untuk backfill.',
    )
  }
}

async function listAllUsers(client) {
  const users = []
  let page = 1

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: DEFAULT_PER_PAGE,
    })

    if (error) {
      throw new Error(`Gagal membaca daftar user: ${error.message}`)
    }

    const batch = data?.users ?? []
    users.push(...batch)

    if (batch.length < DEFAULT_PER_PAGE) break
    page += 1
  }

  return users
}

export function selectTargets(users, emails, ids) {
  const emailSet = new Set(emails)
  const idSet = new Set(ids)

  return users.filter(
    (user) => idSet.has(user.id) || (user.email && emailSet.has(user.email.toLowerCase())),
  )
}

export function findMissing(options, targets) {
  const foundEmails = new Set(
    targets.map((user) => user.email?.toLowerCase()).filter((email) => Boolean(email)),
  )
  const foundIds = new Set(targets.map((user) => user.id))

  return {
    emails: options.emails.filter((email) => !foundEmails.has(email)),
    ids: options.ids.filter((id) => !foundIds.has(id)),
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

  const users = await listAllUsers(client)
  const targets = selectTargets(users, options.emails, options.ids)
  const missing = findMissing(options, targets)

  if (missing.emails.length > 0 || missing.ids.length > 0) {
    console.error(
      `Target tidak ditemukan: ${[...missing.emails, ...missing.ids].join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  const changes = targets.filter((user) => user.app_metadata?.role !== 'organizer')

  console.log(`User dibaca: ${users.length}; target: ${targets.length}; perlu diubah: ${changes.length}.`)

  for (const user of changes) {
    const current = user.app_metadata?.role ?? '(kosong)'
    console.log(`  ${user.email ?? user.id}: ${current} -> organizer`)
  }

  if (changes.length === 0) {
    console.log('Semua target sudah organizer. Tidak ada perubahan.')
    return
  }

  if (!options.apply) {
    console.log('Mode dry-run. Tambahkan --apply untuk menulis app_metadata.')
    return
  }

  for (const user of changes) {
    const { error } = await client.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, role: 'organizer' },
    })

    if (error) {
      throw new Error(`Gagal memperbarui ${user.email ?? user.id}: ${error.message}`)
    }

    console.log(`Diperbarui: ${user.email ?? user.id}`)
  }

  console.log('Backfill selesai. Minta pengguna logout/login agar JWT diperbarui.')
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
