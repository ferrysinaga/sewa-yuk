import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import BlueprintWorkspace from '../../components/map/BlueprintWorkspace'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import BlueprintMetadataForm from './blueprint-editor/BlueprintMetadataForm'
import EditorHeader from './blueprint-editor/EditorHeader'
import { useBlueprintEditor } from './blueprint-editor/useBlueprintEditor'

export default function BlueprintEditor() {
  const state = useBlueprintEditor()
  const { draft, loading, loadError } = state
  useDocumentTitle(draft?.name ?? 'Editor Denah')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-8 focus:outline-none sm:px-6 lg:px-8"
      >
        <EditorHeader state={state} />

        {!loading && !loadError && draft && (
          <BlueprintMetadataForm
            draft={draft}
            blueprintId={state.blueprintId}
            savedImagePath={state.savedImagePath}
            saving={state.saving}
            updateDraft={state.updateDraft}
          />
        )}

        {loading && (
          <LoadingPanel
            title="Memuat denah dari Supabase..."
            titleClassName="text-sm text-muted"
            minHeightClassName="min-h-[360px]"
          />
        )}

        {!loading && loadError && (
          <ErrorPanel
            variant="inline"
            title="Gagal memuat denah"
            description={loadError}
            onRetry={state.retry}
            secondaryAction={
              <Link
                to="/admin/blueprint"
                className="inline-flex shrink-0 items-center justify-center rounded-[6px] border border-danger bg-surface px-4 py-2 text-sm font-semibold text-danger-dark transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
              >
                Daftar denah
              </Link>
            }
          />
        )}

        {!loading && !loadError && draft && (
          <div className="mt-6">
            <BlueprintWorkspace />
          </div>
        )}
      </main>
    </div>
  )
}
