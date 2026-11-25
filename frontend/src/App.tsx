/**
 * Az alkalmazás „karmestere”.
 *
 * Mit csinál?
 * - Egyszer betölti a teljes katalógust az API-ból.
 * - Tárolja a közös állapotot: melyik adatbázisok vannak kijelölve összehasonlításra.
 * - Az URL alapján (#/catalog, #/compare, #/methodology) eldönti, melyik oldal látszik,
 *   és hogy nyitva van-e egy adatlap (#/catalog?dataset=12).
 *
 * Maguk az oldalak a features/ mappában vannak; ez a fájl csak összeköti őket.
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from './api/client.ts'
import { MAX_COMPARE_DATASETS, toggleCompareSelection } from './domain/compare.ts'
import type { ECGDatabase } from './domain/types.ts'
import { useHashRoute } from './hooks/useHashRoute.ts'
import Header from './layout/Header.tsx'
import { s } from './i18n/strings.ts'
import { useLang } from './i18n/useLang.ts'
import CatalogPage from './features/catalog/CatalogPage.tsx'
import ComparePage from './features/compare/ComparePage.tsx'
import MethodologyPage from './features/methodology/MethodologyPage.tsx'
import ChooserPage from './features/chooser/ChooserPage.tsx'
import DatasetDetail from './features/dataset/DatasetDetail.tsx'

type LoadState = 'loading' | 'ready' | 'error'

export default function App() {
  const { route, navigate } = useHashRoute()
  const { t } = useLang()
  const [databases, setDatabases] = useState<ECGDatabase[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [notice, setNotice] = useState('')

  // A teljes katalógus betöltése. Minden oldal ugyanezt az adatot használja.
  useEffect(() => {
    const controller = new AbortController()
    api.listDatasets(controller.signal)
      .then((data) => {
        setDatabases(data)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setLoadState('error')
      })
    return () => controller.abort()
  }, [reloadKey])

  const openDataset = useMemo(() => databases.find((db) => db.id === route.datasetId) ?? null, [databases, route.datasetId])

  const toggleCompare = (id: number) => {
    const result = toggleCompareSelection(compareIds, id)
    setNotice(result.limitReached ? t(s.app.compareLimit(MAX_COMPARE_DATASETS)) : '')
    setCompareIds(result.ids)
  }

  const retry = () => {
    setLoadState('loading')
    setReloadKey((key) => key + 1)
  }

  const renderPage = () => {
    switch (route.page) {
      case 'catalog':
        return <CatalogPage databases={databases} compareIds={compareIds} onOpen={(id) => navigate({ datasetId: id })} onToggleCompare={toggleCompare} />
      case 'choose':
        return (
          <ChooserPage
            databases={databases}
            onOpen={(id) => navigate({ datasetId: id })}
            onCompareAll={(ids) => { setCompareIds(ids.slice(0, MAX_COMPARE_DATASETS)); navigate({ page: 'compare' }) }}
          />
        )
      case 'compare':
        return <ComparePage databases={databases} compareIds={compareIds} onToggle={toggleCompare} onReset={() => setCompareIds([])} />
      case 'methodology':
        return <MethodologyPage databases={databases} onOpen={(id) => navigate({ datasetId: id })} />
    }
  }

  return (
    <>
      <Header activePage={route.page} compareCount={compareIds.length} />

      <main className="page">
        {notice && (
          <p className="notice" role="status">
            {notice} <button type="button" className="link-button" onClick={() => setNotice('')}>{t(s.app.dismiss)}</button>
          </p>
        )}

        {loadState === 'loading' && <p className="status-line">{t(s.app.loading)}</p>}

        {loadState === 'error' && (
          <div className="notice notice-error" role="alert">
            <p><strong>{t(s.app.loadErrorTitle)}</strong> {t(s.app.loadErrorHint)}</p>
            <button type="button" className="button" onClick={retry}>{t(s.app.retry)}</button>
          </div>
        )}

        {loadState === 'ready' && renderPage()}
      </main>

      {openDataset && (
        <DatasetDetail
          database={openDataset}
          inComparison={compareIds.includes(openDataset.id)}
          compareFull={compareIds.length >= MAX_COMPARE_DATASETS}
          onClose={() => navigate({ datasetId: null })}
          onToggleCompare={toggleCompare}
        />
      )}
    </>
  )
}
