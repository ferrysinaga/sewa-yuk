import AppHeader from '../../components/layout/AppHeader'
import { EmptyPanel, ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import BlueprintCard from './blueprint-list/BlueprintCard'
import BlueprintListHeader from './blueprint-list/BlueprintListHeader'
import CreateBlueprintForm from './blueprint-list/CreateBlueprintForm'
import { useAdminBlueprintList } from './blueprint-list/useAdminBlueprintList'

export default function BlueprintList() {
  const list = useAdminBlueprintList()
  useDocumentTitle('Kelola Denah')

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 focus:outline-none sm:px-6 lg:px-8">
        <BlueprintListHeader
          showCreate={list.showCreate}
          onToggleCreate={list.toggleCreate}
        />

        {list.showCreate && (
          <CreateBlueprintForm
            name={list.name}
            blueprintId={list.blueprintId}
            venue={list.venue}
            eventDate={list.eventDate}
            description={list.description}
            formError={list.formError}
            creating={list.creating}
            onNameChange={list.handleNameChange}
            onIdChange={list.handleIdChange}
            onVenueChange={list.setVenue}
            onEventDateChange={list.setEventDate}
            onDescriptionChange={list.setDescription}
            onCancel={list.closeCreate}
            onCreate={() => void list.handleCreate()}
          />
        )}

        {!list.loading && !list.error && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span>
              <span className="font-semibold text-ink">{list.summaries.length}</span> denah
            </span>
            <span>
              <span className="font-semibold text-pine-dark">{list.publishedCount}</span> dipublikasikan
            </span>
            <span>
              <span className="font-semibold text-clay-dark">{list.draftCount}</span> draft
            </span>
          </div>
        )}

        {list.loading && (
          <LoadingPanel
            title="Memuat denah…"
            description="Mengambil daftar denah dan jumlah booth dari Supabase."
          />
        )}

        {!list.loading && list.error && (
          <ErrorPanel
            title="Gagal memuat denah"
            description={list.error}
            onRetry={list.retry}
          />
        )}

        {!list.loading && !list.error && list.summaries.length === 0 && (
          <EmptyPanel
            icon="list"
            paddingClassName="p-10"
            title="Belum ada denah"
            description="Buat denah pertama, tambahkan booth, lalu publikasikan agar tenant dapat melihatnya."
            action={
              <button
                type="button"
                onClick={list.openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
              >
                Buat Denah Baru
              </button>
            }
          />
        )}

        {!list.loading && !list.error && list.summaries.length > 0 && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.summaries.map((blueprint) => (
              <BlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                isUpdating={list.updatingIds.includes(blueprint.id)}
                editing={list.editingId === blueprint.id}
                editDraft={list.editDraft}
                editError={list.editError}
                savingEdit={list.savingEditId === blueprint.id}
                confirmingDelete={list.confirmingDeleteId === blueprint.id}
                deleting={list.deletingId === blueprint.id}
                onEditDraftChange={list.setEditDraft}
                onStartEdit={() => list.startEdit(blueprint)}
                onCancelEdit={list.cancelEdit}
                onSaveEdit={() => void list.handleSaveEdit(blueprint)}
                onPublishToggle={() => void list.handlePublishToggle(blueprint)}
                onToggleDelete={() => {
                  if (list.editingId === blueprint.id) list.cancelEdit()
                  list.toggleConfirmDelete(blueprint.id)
                }}
                onConfirmDelete={() => void list.handleDelete(blueprint)}
                onCancelDelete={() => list.toggleConfirmDelete(blueprint.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
