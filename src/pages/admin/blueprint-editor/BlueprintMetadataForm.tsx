import BlueprintImageUploader from '../../../components/admin/BlueprintImageUploader'
import { BLUEPRINT_STATUS_LABEL, BLUEPRINT_STATUS_OPTIONS } from '../../../types/blueprint'
import type { BlueprintDraft, BlueprintStatus } from '../../../types/blueprint'

interface BlueprintMetadataFormProps {
  draft: BlueprintDraft
  blueprintId: string
  savedImagePath: string
  saving: boolean
  updateDraft: (patch: Partial<BlueprintDraft>) => void
}

export default function BlueprintMetadataForm({
  draft,
  blueprintId,
  savedImagePath,
  saving,
  updateDraft,
}: BlueprintMetadataFormProps) {
  return (
    <section className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Informasi denah</h2>
          <p className="mt-1 text-xs text-muted">Metadata ini tampil di halaman event tenant.</p>
        </div>
        <select
          value={draft.status}
          onChange={(event) => updateDraft({ status: event.target.value as BlueprintStatus })}
          aria-label="Status publikasi denah"
          className="rounded-control border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
        >
          {BLUEPRINT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {BLUEPRINT_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="editor-blueprint-name" className="text-xs font-medium text-ink">
            Nama denah / event
          </label>
          <input
            id="editor-blueprint-name"
            type="text"
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="mt-1.5 w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div>
          <label htmlFor="editor-blueprint-venue" className="text-xs font-medium text-ink">
            Venue
          </label>
          <input
            id="editor-blueprint-venue"
            type="text"
            value={draft.venue}
            onChange={(event) => updateDraft({ venue: event.target.value })}
            placeholder="Nama venue dan hall"
            className="mt-1.5 w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div>
          <label htmlFor="editor-blueprint-date" className="text-xs font-medium text-ink">
            Tanggal event
          </label>
          <input
            id="editor-blueprint-date"
            type="text"
            value={draft.eventDate}
            onChange={(event) => updateDraft({ eventDate: event.target.value })}
            placeholder="12 - 15 Maret 2026"
            className="mt-1.5 w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="editor-blueprint-description" className="text-xs font-medium text-ink">
            Deskripsi
          </label>
          <textarea
            id="editor-blueprint-description"
            value={draft.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
            rows={3}
            placeholder="Deskripsi singkat event untuk tenant."
            className="mt-1.5 w-full resize-y rounded-card-sm border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
          />
        </div>

        <div className="border-t border-line pt-4 sm:col-span-2">
          <BlueprintImageUploader
            blueprintId={blueprintId}
            imageUrl={draft.imageUrl}
            imagePath={draft.imagePath}
            savedImagePath={savedImagePath}
            onChange={(image) =>
              updateDraft({
                imageUrl: image?.url ?? '',
                imagePath: image?.path ?? '',
              })
            }
            disabled={saving}
          />
        </div>
      </div>

      <p className="mt-3 text-compact leading-relaxed text-muted">
        {draft.status === 'published'
          ? 'Denah berstatus Dipublikasikan dan dapat dilihat tenant setelah perubahan disimpan.'
          : draft.status === 'archived'
            ? 'Denah Diarsipkan tidak tampil di halaman event tenant.'
            : 'Denah masih Draft. Publikasikan agar tenant dapat melihat dan memilih booth.'}
      </p>
    </section>
  )
}
