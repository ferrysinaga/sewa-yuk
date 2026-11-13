#!/usr/bin/env node
/**
 * Pemindai secret sederhana untuk repo dan bundle produksi.
 *
 * Yang diperiksa:
 * 1. File `.env`/`.env.e2e` tidak boleh ikut ter-track (file contoh boleh).
 * 2. Pola secret yang jelas (private key, AWS, GitHub, Stripe live, Supabase
 *    secret key baru).
 * 3. JWT yang klaim payload-nya `role: service_role` di file tracked atau di
 *    `dist/`. Anon key JWT tetap diizinkan karena memang publik.
 *
 * Jalankan `npm run security:secrets`. Skrip ini sengaja tanpa dependensi
 * tambahan agar bisa dipakai di lokal dan CI.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const findings = []

const patterns = [
  {
    name: 'private key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'AWS access key',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub token',
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    name: 'Stripe live secret key',
    regex: /\bsk_live_[0-9A-Za-z]{24,}\b/,
  },
  {
    name: 'Supabase secret key',
    regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  },
]

const jwtPattern = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })

  return output.split('\0').filter(Boolean)
}

function listDistFiles() {
  const distDir = join(root, 'dist')
  if (!existsSync(distDir)) return []

  const files = []

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(absolute)
      } else if (entry.isFile()) {
        files.push(relative(root, absolute).replaceAll('\\', '/'))
      }
    }
  }

  walk(distDir)
  return files
}

function readText(file) {
  let buffer

  try {
    buffer = readFileSync(join(root, file))
  } catch {
    return null
  }

  // Lewati file biner (gambar, font, arsip) yang tidak relevan.
  if (buffer.subarray(0, 8000).includes(0)) return null

  return buffer.toString('utf8')
}

function decodeJwtRole(token) {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    const parsed = JSON.parse(json)
    return typeof parsed.role === 'string' ? parsed.role : null
  } catch {
    return null
  }
}

function scanFile(file, text) {
  const lines = text.split(/\r?\n/)

  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          file,
          line: index + 1,
          detail: pattern.name,
        })
      }
    }

    for (const token of line.match(jwtPattern) ?? []) {
      if (decodeJwtRole(token) === 'service_role') {
        findings.push({
          file,
          line: index + 1,
          detail: 'JWT dengan role service_role',
        })
      }
    }
  }
}

function checkTrackedEnvFiles(files) {
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    if (/(^|\/)\.env(\.e2e)?$/.test(normalized)) {
      findings.push({
        file: normalized,
        line: 1,
        detail: 'file environment rahasia ikut ter-track',
      })
    }
  }
}

const trackedFiles = listTrackedFiles()
checkTrackedEnvFiles(trackedFiles)

for (const file of trackedFiles) {
  const text = readText(file)
  if (text !== null) scanFile(file, text)
}

const distFiles = listDistFiles()
for (const file of distFiles) {
  const text = readText(file)
  if (text !== null) scanFile(file, text)
}

console.log('Secret scan')
console.log(`  File tracked : ${trackedFiles.length}`)
console.log(`  File dist    : ${distFiles.length}`)

if (findings.length > 0) {
  console.error('\nSecret terdeteksi:')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.detail}`)
  }
  console.error('\nHapus secret dari repo, rotasi kunci, dan bersihkan riwayat bila perlu.')
  process.exit(1)
}

console.log('  Tidak ada secret sensitif yang terdeteksi.')
