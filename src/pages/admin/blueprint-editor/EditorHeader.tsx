import { Link } from 'react-router-dom'
import Spinner from '../../../components/ui/Spinner'
import {
  BLUEPRINT_STATUS_BADGE,
  BLUEPRINT_STATUS_LABEL,
} from '../../../types/blueprint'
import type { BlueprintEditorState } from './useBlueprintEditor'

export default function EditorHeader({ state }: { state: BlueprintEditorState }) {
  const { blueprintId, draft, isDirty, boothCount, loading, loadError, saving } = state
  const statusLabel = draft ? BLUEPRINT_STATUS_LABEL[draft.status] : null

  return (
    <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
      <div className="max-w-2xl">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-[4px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
            <path
              d="M16 10H5m4-4-4 4 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Kembali ke dashboard
        </Link>

        <div className="mt-3 flex items-center gap-2.5">
          <span aria-hidden="true" className="h-px w-6 bg-clay" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Editor denah
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            {draft?.name || 'Blueprint Editor'}
          </h1>
          {draft && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[draft.status]}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  draft.status === 'published'
                    ? 'bg-pine'
                    : draft.status === 'draft'
                      ? 'bg-clay'
                      : 'bg-muted'
                }`}
              />
              {statusLabel}
            </span>
          )}
          {isDirty && (
            <span className="inline-flex items-center gap-2 rounded-[4px] border border-line bg-clay-soft px-2.5 py-1 text-[11px] font-medium text-clay-dark">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
              Perubahan belum disimpan
            </span>
          )}
          {!loading && !loadError && (
            <span className="text-xs font-medium text-muted">{boothCount} booth</span>
          )}
          {loading && <span className="text-xs text-muted">Memuat denah…</span>}
        </div>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Tarik kategori booth ke kanvas, atur posisi dengan snap-to-grid, lalu simpan
          konfigurasi ke Supabase.
        </p>
        <p className="mt-1 text-sm text-muted">
          {[draft?.venue, draft?.eventDate].filter(Boolean).join(' · ') ||
            (loading ? 'Memuat informasi event...' : 'Lengkapi informasi denah di bawah.')}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">/event/{blueprintId}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!loading && !loadError && (
          <Link
            to={`/event/${blueprintId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path
                fillRule="evenodd"
                d="M.664 10.59a1.65 1.65 0 0 1 0-1.18 10.05 10.05 0 0 1 18.672 0 1.65 1.65 0 0 1 0 1.18 10.05 10.05 0 0 1-18.672 0ZM14.5 10a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                clipRule="evenodd"
              />
            </svg>
            Pratinjau
          </Link>
        )}
        <button
          type="button"
          onClick={() => void state.handleSave()}
          disabled={saving || loading || Boolean(loadError) || !draft}
          className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          {saving ? (
            <>
              <Spinner size="md" tone="white" />
              Menyimpan…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.5 3.75A1.75 1.75 0 0 1 5.25 2h7.69a1.75 1.75 0 0 1 1.237.513l2.31 2.31A1.75 1.75 0 0 1 17 6.06v10.19A1.75 1.75 0 0 1 15.25 18H5.25A1.75 1.75 0 0 1 3.5 16.25V3.75Zm3.25-.25a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75H6.75Zm8.5 6.5H5.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10Z" />
              </svg>
              Simpan perubahan denah
            </>
          )}
        </button>
      </div>
    </div>
  )
}
