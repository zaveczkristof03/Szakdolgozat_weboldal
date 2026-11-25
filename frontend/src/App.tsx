/**
 * Az alkalmazás „karmestere”.
 *
 * Mit csinál?
 * - Egyszer betölti a teljes katalógust az API-ból.
 * - Tárolja a közös állapotot: összehasonlítási kijelölés, gyűjtemények,
 *   admin token, állapotüzenet.
 * - Az URL alapján (#/catalog, #/compare, …) eldönti, melyik oldal látszik.
 *
 * Maguk az oldalak a features/ mappában vannak; ez a fájl csak összeköti őket.
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from './api/client.ts'
import { MAX_COMPARE_DATASETS, toggleCompareSelection } from './domain/compare.ts'
import { addDatasetToCollection, readResearchCollections, writeResearchCollections } from './domain/collections.ts'
import type { ECGDatabase, ResearchCollection } from './domain/types.ts'
import { useHashRoute, type Page } from './hooks/useHashRoute.ts'
import Sidebar from './layout/Sidebar.tsx'
import { pageTitles } from './layout/pages.ts'
import Topbar from './layout/Topbar.tsx'
import CatalogPage from './features/catalog/CatalogPage.tsx'
import ComparePage from './features/compare/ComparePage.tsx'
import StatisticsPage from './features/statistics/StatisticsPage.tsx'
import ResearchFinder from './features/finder/ResearchFinder.tsx'
import MetadataQuality from './features/quality/MetadataQuality.tsx'
import MyResearch from './features/research/MyResearch.tsx'
import DatasetDetailModal from './features/dataset/DatasetDetailModal.tsx'
import AdminLoginModal from './features/admin/AdminLoginModal.tsx'
import DatasetFormModal from './features/admin/DatasetFormModal.tsx'
import DeleteDatasetModal from './features/admin/DeleteDatasetModal.tsx'

const pageIntros: Record<Page, string> = {
  catalog: 'Find open electrocardiogram datasets by the metadata that matters to your research.',
  finder: 'Define the signal and annotation requirements for your study. Results are matched against documented catalog metadata, with the reasons shown beside each dataset.',
  compare: 'Compare up to four datasets and inspect the differences that matter.',
  quality: 'Review how much metadata is recorded for each dataset and which documentation checks related to the FAIR principles are satisfied.',
  statistics: 'Explore the structure and documentation of the datasets in this catalog.',
  research: 'Keep relevant datasets together, add your own research notes and export a traceable selection.',
}

type ApiStatus = 'Connecting' | 'Connected' | 'Unavailable'
type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; dataset: ECGDatabase }

export default function App() {
  const { route, navigate } = useHashRoute()
  const [databases, setDatabases] = useState<ECGDatabase[]>([])
  const [apiStatus, setApiStatus] = useState<ApiStatus>('Connecting')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [collections, setCollections] = useState<ResearchCollection[]>(readResearchCollections)
  const [activeCollectionId, setActiveCollectionId] = useState(() => collections[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<ECGDatabase | null>(null)

  // A teljes katalógus betöltése. Minden oldal ugyanezt az adatot használja.
  useEffect(() => {
    const controller = new AbortController()
    api.listDatasets(controller.signal)
      .then((data) => {
        setDatabases(data)
        setCompareIds((current) => current.filter((id) => data.some((db) => db.id === id)).slice(0, MAX_COMPARE_DATASETS))
        setApiStatus('Connected')
        setLoadError('')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setApiStatus('Unavailable')
        setLoadError('Could not load datasets. Check that the backend is running at 127.0.0.1:8000.')
      })
    return () => controller.abort()
  }, [reloadKey])

  const updateCollections = (next: ResearchCollection[]) => {
    setCollections(next)
    if (!writeResearchCollections(next)) setMessage('Research collection could not be saved. Browser storage may be full or unavailable.')
  }

  const loading = apiStatus === 'Connecting'
  const detailsDatabase = useMemo(() => databases.find((db) => db.id === route.datasetId) ?? null, [databases, route.datasetId])

  const openDetails = (id: number) => navigate({ datasetId: id })
  const closeDetails = () => navigate({ datasetId: null })

  const toggleCompare = (id: number) => {
    const result = toggleCompareSelection(compareIds, id)
    if (result.limitReached) setMessage(`You can compare up to ${MAX_COMPARE_DATASETS} datasets at a time. Remove one selection first.`)
    setCompareIds(result.ids)
  }

  // Mentés a gyűjteménybe: NEM visz át másik oldalra, csak visszajelez.
  const saveToResearch = (id: number) => {
    const dataset = databases.find((db) => db.id === id)
    if (!dataset) return
    const result = addDatasetToCollection(collections, activeCollectionId, id)
    if (!result.alreadyPresent) updateCollections(result.collections)
    setActiveCollectionId(result.targetId)
    setMessage(result.alreadyPresent ? `“${dataset.name}” is already in “${result.targetName}”.` : `“${dataset.name}” added to “${result.targetName}”.`)
  }

  const logout = () => {
    if (adminToken) void api.logout(adminToken).catch(() => undefined)
    setAdminToken(null)
    setForm({ mode: 'closed' })
    setDeleteTarget(null)
    setMessage('Admin mode disabled. The catalog is now read-only.')
  }

  const sessionExpired = () => {
    setAdminToken(null)
    setMessage('Your admin session has expired. Please log in again.')
  }

  const onSaved = (saved: ECGDatabase, created: boolean) => {
    setDatabases((current) => (created ? [...current, saved] : current.map((db) => (db.id === saved.id ? saved : db))).sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ mode: 'closed' })
    setMessage(created ? `“${saved.name}” was added to the catalog.` : `“${saved.name}” was updated.`)
  }

  const onDeleted = (deleted: ECGDatabase) => {
    setDatabases((current) => current.filter((db) => db.id !== deleted.id))
    setCompareIds((current) => current.filter((id) => id !== deleted.id))
    setDeleteTarget(null)
    if (route.datasetId === deleted.id) closeDetails()
    setMessage(`“${deleted.name}” was deleted from the catalog.`)
  }

  const renderPage = () => {
    switch (route.page) {
      case 'catalog':
        return (
          <CatalogPage
            databases={databases} compareIds={compareIds} isAdmin={adminToken !== null}
            onOpen={openDetails} onToggleCompare={toggleCompare} onSave={saveToResearch}
            onCreate={() => setForm({ mode: 'create' })} onEdit={(dataset) => setForm({ mode: 'edit', dataset })} onDelete={setDeleteTarget}
          />
        )
      case 'finder':
        return (
          <ResearchFinder
            databases={databases} compareIds={compareIds} onOpen={openDetails} onSave={saveToResearch}
            onCompare={(id) => { toggleCompare(id); navigate({ page: 'compare' }) }}
          />
        )
      case 'compare':
        return <ComparePage databases={databases} compareIds={compareIds} onToggle={toggleCompare} onReset={() => setCompareIds([])} onOpenCatalog={() => navigate({ page: 'catalog' })} />
      case 'quality':
        return <MetadataQuality databases={databases} />
      case 'statistics':
        return <StatisticsPage databases={databases} />
      case 'research':
        return (
          <MyResearch
            databases={databases} collections={collections} onCollectionsChange={updateCollections}
            selectedCollectionId={activeCollectionId} onSelectCollection={setActiveCollectionId}
            compareIds={compareIds} onOpen={openDetails}
            onCompare={(id) => { toggleCompare(id); navigate({ page: 'compare' }) }}
          />
        )
    }
  }

  return (
    <main className="app-shell">
      <Sidebar activePage={route.page} apiStatus={apiStatus} compareCount={compareIds.length} onNavigate={(page) => navigate({ page })} />

      <section className="workspace">
        <Topbar title={pageTitles[route.page]} apiStatus={apiStatus} isAdmin={adminToken !== null} onLogin={() => setLoginOpen(true)} onLogout={logout} />

        <div className="page-content">
          <section className="page-intro">
            <div>
              <h1>{route.page === 'catalog' ? 'EKG MetaData Explorer' : pageTitles[route.page]}</h1>
              <p>{pageIntros[route.page]}</p>
            </div>
          </section>

          {message && (
            <div className="feature-message" role="status">
              <span>{message}</span>
              <button type="button" className="text-button" onClick={() => setMessage('')} aria-label="Dismiss message">Dismiss</button>
            </div>
          )}

          {loading && (
            <div className="notice"><span className="loading-spinner" />Loading datasets from the API…</div>
          )}

          {loadError && (
            <div className="notice notice-error" role="alert">
              <strong>Unable to load data</strong>
              <span>{loadError}</span>
              <button type="button" onClick={() => { setApiStatus('Connecting'); setLoadError(''); setReloadKey((key) => key + 1) }}>Retry</button>
            </div>
          )}

          {!loading && !loadError && renderPage()}
        </div>
      </section>

      {loginOpen && (
        <AdminLoginModal
          onClose={() => setLoginOpen(false)}
          onLoggedIn={(token) => { setAdminToken(token); setLoginOpen(false); setMessage('Admin mode enabled. You can now add, edit, and delete catalog entries.') }}
        />
      )}

      {form.mode !== 'closed' && adminToken && (
        <DatasetFormModal
          editing={form.mode === 'edit' ? form.dataset : null} token={adminToken}
          onClose={() => setForm({ mode: 'closed' })} onSaved={onSaved} onUnauthorized={sessionExpired}
        />
      )}

      {deleteTarget && adminToken && (
        <DeleteDatasetModal target={deleteTarget} token={adminToken} onClose={() => setDeleteTarget(null)} onDeleted={onDeleted} onUnauthorized={sessionExpired} />
      )}

      {detailsDatabase && (
        <DatasetDetailModal
          database={detailsDatabase}
          inComparison={compareIds.includes(detailsDatabase.id)}
          compareFull={compareIds.length >= MAX_COMPARE_DATASETS}
          onClose={closeDetails}
          onSave={saveToResearch}
          onToggleCompare={toggleCompare}
        />
      )}
    </main>
  )
}
