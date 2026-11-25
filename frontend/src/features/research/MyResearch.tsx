/**
 * My Research: saját kutatási gyűjtemények, jegyzetek, CSV-export.
 * A mentés a böngészőben történik (domain/collections.ts), fiók nem kell.
 */
import { useMemo, useState } from 'react'
import { createCollectionId } from '../../domain/collections.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { downloadCsv } from '../../domain/csv.ts'
import { formatOptional } from '../../domain/format.ts'
import type { ECGDatabase, ResearchCollection } from '../../domain/types.ts'

type Props = {
  databases: ECGDatabase[]
  collections: ResearchCollection[]
  onCollectionsChange: (collections: ResearchCollection[]) => void
  selectedCollectionId: string
  onSelectCollection: (id: string) => void
  compareIds: number[]
  onOpen: (id: number) => void
  onCompare: (id: number) => void
}

export default function MyResearch({
  databases,
  collections,
  onCollectionsChange,
  selectedCollectionId,
  onSelectCollection,
  compareIds,
  onOpen,
  onCompare,
}: Props) {
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [createOpen, setCreateOpen] = useState(collections.length === 0)
  const [message, setMessage] = useState('')

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null
  const savedDatasets = useMemo(() => {
    if (!selectedCollection) return []
    return selectedCollection.datasetIds
      .map((id) => databases.find((database) => database.id === id))
      .filter((database): database is ECGDatabase => Boolean(database))
  }, [databases, selectedCollection])
  const missingIds = selectedCollection?.datasetIds.filter((id) => !databases.some((database) => database.id === id)) ?? []

  const createCollection = () => {
    const name = newName.trim()
    if (!name) {
      setMessage('Enter a name for the research collection.')
      return
    }
    if (collections.some((collection) => collection.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setMessage('A collection with this name already exists.')
      return
    }
    const created: ResearchCollection = {
      id: createCollectionId(),
      name,
      description: newDescription.trim(),
      createdAt: new Date().toISOString(),
      datasetIds: [],
      notes: {},
    }
    onCollectionsChange([...collections, created])
    onSelectCollection(created.id)
    setNewName('')
    setNewDescription('')
    setCreateOpen(false)
    setMessage(`Collection “${name}” created in this browser.`)
  }

  const updateCollection = (updated: ResearchCollection) => {
    onCollectionsChange(collections.map((collection) => collection.id === updated.id ? updated : collection))
  }

  const removeDataset = (id: number) => {
    if (!selectedCollection) return
    updateCollection({
      ...selectedCollection,
      datasetIds: selectedCollection.datasetIds.filter((datasetId) => datasetId !== id),
      notes: Object.fromEntries(Object.entries(selectedCollection.notes).filter(([key]) => Number(key) !== id)),
    })
  }

  const updateNote = (id: number, note: string) => {
    if (!selectedCollection) return
    updateCollection({
      ...selectedCollection,
      notes: { ...selectedCollection.notes, [String(id)]: note },
    })
  }

  const addCurrentComparison = () => {
    if (!selectedCollection || !compareIds.length) return
    const nextIds = [...new Set([...selectedCollection.datasetIds, ...compareIds])]
    updateCollection({ ...selectedCollection, datasetIds: nextIds })
    setMessage(`${compareIds.length} comparison selection(s) added to “${selectedCollection.name}”.`)
  }

  const exportCollection = () => {
    if (!selectedCollection) return
    const rows: unknown[][] = [[
      'dataset_id', 'dataset_name', 'short_name', 'records', 'subjects',
      'sampling_frequency_hz', 'ecg_leads', 'clinical_focus', 'annotations',
      'file_format', 'license', 'doi', 'source_url', 'research_note',
    ]]
    for (const database of savedDatasets) {
      rows.push([
        database.id,
        database.name,
        database.short_name ?? '',
        database.records ?? '',
        database.subject_count ?? '',
        database.frequency ?? '',
        database.leads ?? '',
        database.category,
        database.annotations ?? '',
        database.file_format ?? '',
        database.license ?? '',
        database.doi ?? '',
        database.source_url,
        selectedCollection.notes[String(database.id)] ?? '',
      ])
    }
    downloadCsv(`research-collection-${selectedCollection.name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, rows)
    setMessage('Collection exported as CSV.')
  }

  const deleteCollection = () => {
    if (!selectedCollection) return
    const confirmed = window.confirm(`Delete the “${selectedCollection.name}” collection from this browser?`)
    if (!confirmed) return
    const next = collections.filter((collection) => collection.id !== selectedCollection.id)
    onCollectionsChange(next)
    onSelectCollection(next[0]?.id ?? '')
    setCreateOpen(next.length === 0)
    setMessage('Collection deleted from this browser.')
  }

  return (
    <div className="feature-page">
      <section className="feature-intro">
        <div className="finder-count"><strong>{savedDatasets.length}</strong><span>datasets in current collection</span></div>
      </section>

      {message && <div className="feature-message" role="status">{message}</div>}

      <section className="panel collection-panel">
        <div className="collection-toolbar">
          <label className="filter-field collection-select-field">
            <span>Research collection</span>
            <select value={selectedCollection?.id ?? ''} onChange={(event) => onSelectCollection(event.target.value)} disabled={!collections.length}>
              {!collections.length && <option value="">No collections yet</option>}
              {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
          </label>
          <div className="collection-actions">
            <button type="button" className="secondary-button" onClick={() => setCreateOpen((value) => !value)}>{createOpen ? 'Close form' : 'New collection'}</button>
            <button type="button" className="secondary-button" onClick={addCurrentComparison} disabled={!selectedCollection || !compareIds.length}>Add current comparison</button>
            <button type="button" className="export-button" onClick={exportCollection} disabled={!selectedCollection || !savedDatasets.length}>Export CSV</button>
          </div>
        </div>

        {createOpen && (
          <div className="create-collection-form">
            <div>
              <h3>Create a research collection</h3>
              <p>Collections are stored in this browser only. They are not uploaded to the API.</p>
            </div>
            <label className="filter-field"><span>Collection name</span><input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} placeholder="e.g. Atrial fibrillation study" /></label>
            <label className="filter-field"><span>Purpose (optional)</span><input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} maxLength={240} placeholder="What are you investigating?" /></label>
            <button type="button" className="primary-action-button" onClick={createCollection} disabled={!newName.trim()}>Create collection</button>
          </div>
        )}

        {selectedCollection ? (
          <>
            <div className="collection-heading-row">
              <div>
                <h3>{selectedCollection.name}</h3>
                <p>{selectedCollection.description || 'No purpose note added.'} · Created {new Date(selectedCollection.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="collection-heading-actions">
                <span className="result-count">{savedDatasets.length} saved</span>
                <button type="button" className="text-button danger-text-button" onClick={deleteCollection}>Delete collection</button>
              </div>
            </div>

            {savedDatasets.length ? (
              <div className="saved-research-list">
                {savedDatasets.map((database) => (
                  <article className="saved-research-item" key={database.id}>
                    <div className="saved-research-topline">
                      <div>
                        <button type="button" className="dataset-detail-trigger" onClick={() => onOpen(database.id)}>{database.name}</button>
                        <span className="saved-research-metadata">{formatOptional(database.records)} records · {database.subject_count === null ? 'subjects not recorded' : `${formatOptional(database.subject_count)} subjects`} · {formatOptional(database.frequency, 'Hz')} · {formatOptional(database.leads)} leads · {database.short_name || 'No short name'}</span>
                      </div>
                      <div className="saved-research-actions">
                        <button type="button" className="text-button" onClick={() => onCompare(database.id)} disabled={compareIds.includes(database.id) || compareIds.length >= MAX_COMPARE_DATASETS}>{compareIds.includes(database.id) ? 'In comparison' : 'Compare'}</button>
                        <button type="button" className="text-button danger-text-button" onClick={() => removeDataset(database.id)}>Remove</button>
                      </div>
                    </div>
                    <label className="research-note-field">
                      <span>My research note</span>
                      <textarea value={selectedCollection.notes[String(database.id)] ?? ''} onChange={(event) => updateNote(database.id, event.target.value)} rows={2} maxLength={1000} placeholder="Why is this dataset relevant? Record your own observations…" />
                    </label>
                  </article>
                ))}
              </div>
            ) : (
              <div className="feature-empty-state">
                <strong>This collection is empty.</strong>
                <span>Save datasets from the catalog or add your current comparison to start a research list.</span>
              </div>
            )}
            {missingIds.length > 0 && <p className="collection-warning">{missingIds.length} saved dataset reference(s) are no longer present in the current catalog. Their local notes are retained.</p>}
          </>
        ) : (
          <div className="feature-empty-state">
            <strong>No research collections yet.</strong>
            <span>Create one to save datasets and keep notes between visits on this browser.</span>
            <button type="button" className="text-button" onClick={() => setCreateOpen(true)}>Create your first collection</button>
          </div>
        )}
      </section>
      <p className="feature-footnote">Your research collections and notes are saved in local browser storage on this device. Clearing browser site data will remove them. No account or server-side sync is provided.</p>
    </div>
  )
}
