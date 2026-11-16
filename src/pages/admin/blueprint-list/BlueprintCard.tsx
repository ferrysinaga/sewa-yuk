import { Link } from 'react-router-dom'
import InlineConfirm from '../../../components/ui/InlineConfirm'
import { BLUEPRINT_STATUS_BADGE, BLUEPRINT_STATUS_LABEL } from '../../../types/blueprint'
import type { BlueprintSummary, EditDraft } from './useAdminBlueprintList'

interface BlueprintCardProps {
  blueprint: BlueprintSummary
  isUpdating: boolean
  editing: boolean
  editDraft: EditDraft
  editError: string | null
  savingEdit: boolean
  confirmingDelete: boolean
  deleting: boolean
  onEditDraftChange: (updater: (current: EditDraft) => EditDraft) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onPublishToggle: () => void
  onToggleDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export default function BlueprintCard({
  blueprint,
  isUpdating,
  editing,
  editDraft,
  editError,
  savingEdit,
  confirmingDelete,
  deleting,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onPublishToggle,
  onToggleDelete,
  onConfirmDelete,
  onCancelDelete,
}: BlueprintCardProps) {
  const isPublished = blueprint.status === 'published'

  return (
    <article className="flex flex-col rounded-[10px] border border-line bg-surface p-5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[blueprint.status]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isPublished ? 'bg-pine' : blueprint.status === 'draft' ? 'bg-clay' : 'bg-muted'
            }`}
          />
          {BLUEPRINT_STATUS_LABEL[blueprint.status]}
        </span>
        <span className="text-[11px] text-muted">{blueprint.totalBooths} booth</span>
      </div>

      {blueprint.image_url && (
        <div className="mt-3 overflow-hidden rounded-[8px] border border-line bg-canvas">
          <img
            src={blueprint.image_url}
            alt={`Gambar denah ${blueprint.name}`}
            loading="lazy"
            className="aspect-[1000/640] w-full object-cover"
          />
        </div>
      )}

      {editing ? (
        <div
          id={`edit-form-${blueprint.id}`}
          className="mt-3 rounded-[8px] border border-line bg-canvas p-3"
        >
          <p className="text-xs font-semibold text-ink">Edit detail denah</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            ID denah tetap <span className="font-mono">{blueprint.id}</span> agar tautan event tidak
            berubah.
          </p>

          <div className="mt-3 space-y-2.5">
            <div>
              <label
                htmlFor={`edit-name-${blueprint.id}`}
                className="text-[11px] font-medium text-ink"
              >
                Nama denah
              </label>
              <input
                id={`edit-name-${blueprint.id}`}
                type="text"
                value={editDraft.name}
                onChange={(event) =>
                  onEditDraftChange((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
              />
            </div>
            <div>
              <label
                htmlFor={`edit-venue-${blueprint.id}`}
                className="text-[11px] font-medium text-ink"
              >
                Venue
              </label>
              <input
                id={`edit-venue-${blueprint.id}`}
                type="text"
                value={editDraft.venue}
                onChange={(event) =>
                  onEditDraftChange((current) => ({
                    ...current,
                    venue: event.target.value,
                  }))
                }
                placeholder="Nama venue"
                className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
              />
            </div>
            <div>
              <label
                htmlFor={`edit-date-${blueprint.id}`}
                className="text-[11px] font-medium text-ink"
              >
                Tanggal event
              </label>
              <input
                id={`edit-date-${blueprint.id}`}
                type="text"
                value={editDraft.eventDate}
                onChange={(event) =>
                  onEditDraftChange((current) => ({
                    ...current,
                    eventDate: event.target.value,
                  }))
                }
                placeholder="12 - 15 Maret 2026"
                className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
              />
            </div>
          </div>

          {editError && (
            <p
              role="alert"
              className="mt-3 rounded-[6px] border border-danger bg-danger-soft px-2.5 py-2 text-[11px] leading-relaxed text-danger-dark"
            >
              {editError}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={savingEdit}
              className="inline-flex flex-1 items-center justify-center rounded-[6px] bg-pine px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? 'Menyimpan...' : 'Simpan Detail'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex flex-1 items-center justify-center rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mt-3 text-base font-semibold text-ink">{blueprint.name}</h2>
          <p className="mt-1 text-xs text-muted">{blueprint.venue || 'Venue belum diatur'}</p>
          <p className="mt-0.5 text-xs text-muted">
            {blueprint.event_date || 'Tanggal belum diatur'}
          </p>

          {blueprint.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
              {blueprint.description}
            </p>
          )}
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[8px] bg-canvas p-2.5">
          <p className="text-[11px] text-muted">Tersedia</p>
          <p className="mt-0.5 font-semibold text-ink">
            {blueprint.availableBooths} / {blueprint.totalBooths}
          </p>
        </div>
        <div className="rounded-[8px] bg-canvas p-2.5">
          <p className="text-[11px] text-muted">ID denah</p>
          <p
            className="mt-0.5 truncate font-mono text-[11px] font-semibold text-ink"
            title={blueprint.id}
          >
            {blueprint.id}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Link
          to={`/admin/blueprint/${blueprint.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Atur Denah & Booth
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/event/${blueprint.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
          >
            Pratinjau
          </Link>
          <button
            type="button"
            onClick={onPublishToggle}
            disabled={isUpdating}
            className={`inline-flex items-center justify-center rounded-[8px] px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
              isPublished
                ? 'border border-line bg-surface text-ink hover:bg-canvas'
                : 'bg-pine text-white hover:bg-pine-dark'
            }`}
          >
            {isUpdating ? 'Menyimpan...' : isPublished ? 'Jadikan Draft' : 'Publikasikan'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={editing ? onCancelEdit : onStartEdit}
            aria-expanded={editing}
            aria-controls={editing ? `edit-form-${blueprint.id}` : undefined}
            className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
          >
            {editing ? 'Tutup Edit' : 'Edit Detail'}
          </button>
          <button
            type="button"
            onClick={onToggleDelete}
            aria-expanded={confirmingDelete}
            aria-controls={confirmingDelete ? `delete-blueprint-${blueprint.id}` : undefined}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-[8px] border border-danger bg-surface px-3 py-2 text-xs font-semibold text-danger-dark transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>

        {confirmingDelete && (
          <InlineConfirm
            id={`delete-blueprint-${blueprint.id}`}
            title={`Hapus denah "${blueprint.name}"?`}
            description={
              blueprint.activeBookings > 0
                ? `Denah ini masih memiliki ${blueprint.activeBookings} booking aktif dari total ${blueprint.totalBookings} booking. Selesaikan atau batalkan booking tersebut sebelum menghapus.`
                : blueprint.totalBooths > 0
                  ? `Denah dan ${blueprint.totalBooths} booth di dalamnya akan dihapus permanen. ${blueprint.totalBookings} booking terkait tetap tersimpan sebagai riwayat.`
                  : `Denah akan dihapus permanen. ${blueprint.totalBookings} booking terkait tetap tersimpan sebagai riwayat.`
            }
            confirmLabel={deleting ? 'Menghapus...' : 'Hapus denah'}
            onConfirm={onConfirmDelete}
            onCancel={onCancelDelete}
          />
        )}
      </div>
    </article>
  )
}
