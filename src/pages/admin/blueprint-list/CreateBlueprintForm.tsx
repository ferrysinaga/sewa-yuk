import Spinner from '../../../components/ui/Spinner'

interface CreateBlueprintFormProps {
  name: string
  blueprintId: string
  venue: string
  eventDate: string
  description: string
  formError: string | null
  creating: boolean
  onNameChange: (value: string) => void
  onIdChange: (value: string) => void
  onVenueChange: (value: string) => void
  onEventDateChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCancel: () => void
  onCreate: () => void
}

export default function CreateBlueprintForm({
  name,
  blueprintId,
  venue,
  eventDate,
  description,
  formError,
  creating,
  onNameChange,
  onIdChange,
  onVenueChange,
  onEventDateChange,
  onDescriptionChange,
  onCancel,
  onCreate,
}: CreateBlueprintFormProps) {
  return (
    <section className="mt-6 rounded-[10px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Denah baru</h2>
          <p className="mt-1 text-xs text-muted">
            Denah disimpan sebagai draft. ID denah dipakai pada URL halaman tenant.
          </p>
        </div>
        <span className="rounded-full bg-clay-soft px-3 py-1 text-[11px] font-semibold text-clay-dark ring-1 ring-inset ring-line">
          Draft
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="blueprint-name" className="text-xs font-medium text-ink">
            Nama denah / event
          </label>
          <input
            id="blueprint-name"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Contoh: Pameran Teknologi Nusantara 2026"
            className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div>
          <label htmlFor="blueprint-id" className="text-xs font-medium text-ink">
            ID denah (URL)
          </label>
          <input
            id="blueprint-id"
            type="text"
            value={blueprintId}
            onChange={(event) => onIdChange(event.target.value)}
            placeholder="pameran-teknologi-2026"
            className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
          <p className="mt-1 text-[11px] text-muted">
            Huruf kecil, angka, dan tanda hubung. Contoh URL: /event/
            {blueprintId || 'id-denah'}
          </p>
        </div>

        <div>
          <label htmlFor="blueprint-venue" className="text-xs font-medium text-ink">
            Venue
          </label>
          <input
            id="blueprint-venue"
            type="text"
            value={venue}
            onChange={(event) => onVenueChange(event.target.value)}
            placeholder="Jakarta Convention Center - Hall A"
            className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div>
          <label htmlFor="blueprint-date" className="text-xs font-medium text-ink">
            Tanggal event
          </label>
          <input
            id="blueprint-date"
            type="text"
            value={eventDate}
            onChange={(event) => onEventDateChange(event.target.value)}
            placeholder="12 - 15 Maret 2026"
            className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="blueprint-description" className="text-xs font-medium text-ink">
            Deskripsi
          </label>
          <textarea
            id="blueprint-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            placeholder="Deskripsi singkat event yang akan tampil di halaman tenant."
            className="mt-1.5 w-full resize-y rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-[8px] border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-dark"
        >
          {formError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating && <Spinner size="md" tone="white" />}
          {creating ? 'Membuat...' : 'Buat & Atur Booth'}
        </button>
      </div>
    </section>
  )
}
