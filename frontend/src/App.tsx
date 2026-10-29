import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'

type ECGDatabase = {
  id: number
  name: string
  records: number
  frequency: number
  leads: number
  category: string
  source_url: string
  description: string
  license: string | null
  last_verified: string | null
  short_name?: string | null
  version?: string | null
  doi?: string | null
  records_label?: string | null
  subject_count?: number | null
  duration?: string | null
  annotations?: string | null
  file_format?: string | null
  access_conditions?: string | null
  source_database_id?: string | null
  lightwave_database_id?: string | null
  provenance_url?: string | null
}

type Page = 'catalog' | 'compare' | 'statistics'

type DatasetFormValues = {
  name: string
  records: string
  frequency: string
  leads: string
  category: string
  source_url: string
  description: string
  license: string
  last_verified: string
}

type DatasetPage = {
  items: ECGDatabase[]
  total: number
  page: number
  page_size: number
}

const emptyDatasetForm: DatasetFormValues = {
  name: '',
  records: '0',
  frequency: '250',
  leads: '2',
  category: '',
  source_url: '',
  description: '',
  license: '',
  last_verified: new Date().toISOString().slice(0, 10),
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const API_URL = `${API_BASE_URL}/datasets`
const ADMIN_LOGIN_URL = `${API_BASE_URL}/admin/login`
const formatNumber = (value: number) => value.toLocaleString('en-US')
const licenseName = (db: ECGDatabase) => db.license || 'Not specified'
const safeExternalUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null
  } catch {
    return null
  }
}
const lightwaveUrl = (databaseId: string | null | undefined): string | null =>
  databaseId
    ? `https://physionet.org/lightwave/?db=${encodeURIComponent(databaseId)}`
    : null

function App() {
  const [databases, setDatabases] = useState<ECGDatabase[]>([])
  const [search, setSearch] = useState('')
  const [minFrequency, setMinFrequency] = useState('0')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedLeads, setSelectedLeads] = useState('all')
  const [selectedLicense, setSelectedLicense] = useState('all')
  const [apiStatus, setApiStatus] = useState('Connecting')
  const [activePage, setActivePage] = useState<Page>('catalog')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedCompareIds, setSelectedCompareIds] = useState<number[]>([])
  const [detailsDatabase, setDetailsDatabase] = useState<ECGDatabase | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<DatasetFormValues>(emptyDatasetForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [crudMessage, setCrudMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ECGDatabase | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginError, setAdminLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: '1', page_size: '100' })
    if (search.trim()) params.set('q', search.trim())
    if (minFrequency !== '0') params.set('min_frequency', minFrequency)
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    if (selectedLeads !== 'all') params.set('leads', selectedLeads)
    if (selectedLicense !== 'all') params.set('license', selectedLicense)

    fetch(`${API_URL}/search?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not retrieve datasets.')
        }
        return response.json()
      })
      .then((data: DatasetPage) => {
        setDatabases(data.items)
        setApiStatus('Connected')
        setLoadError('')

        setSelectedCompareIds((current) => {
          const valid = current.filter((id) =>
            data.items.some((db) => db.id === id),
          )

          return valid.length
            ? valid
            : data.items
              .slice(0, Math.min(3, data.items.length))
              .map((db) => db.id)
        })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setApiStatus('Unavailable')
        setLoadError(
          'Could not load datasets. Check that the backend is running at 127.0.0.1:8000.',
        )
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [search, minFrequency, selectedCategory, selectedLeads, selectedLicense])

  const categories = useMemo(
    () =>
      [...new Set(databases.map((db) => db.category).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [databases],
  )

  const leadOptions = useMemo(
    () =>
      [...new Set(databases.map((db) => db.leads))].sort(
        (a, b) => a - b,
      ),
    [databases],
  )

  const licenses = useMemo(
    () =>
      [...new Set(databases.map(licenseName))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [databases],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return databases.filter((db) => {
      const matchesSearch =
        !query || db.name.toLocaleLowerCase().includes(query)

      const matchesFrequency = db.frequency >= Number(minFrequency)

      const matchesCategory =
        selectedCategory === 'all' ||
        db.category === selectedCategory

      const matchesLeads =
        selectedLeads === 'all' ||
        db.leads === Number(selectedLeads)

      const matchesLicense =
        selectedLicense === 'all' ||
        licenseName(db) === selectedLicense

      return (
        matchesSearch &&
        matchesFrequency &&
        matchesCategory &&
        matchesLeads &&
        matchesLicense
      )
    })
  }, [
    databases,
    search,
    minFrequency,
    selectedCategory,
    selectedLeads,
    selectedLicense,
  ])

  const suggestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    if (!query) return []

    return databases
      .filter((db) => db.name.toLocaleLowerCase().includes(query))
      .slice(0, 6)
  }, [databases, search])

  const compareDatabases = databases.filter((db) =>
    selectedCompareIds.includes(db.id),
  )

  const totalRecords = databases.reduce(
    (sum, db) => sum + db.records,
    0,
  )

  const averageFrequency = databases.length
    ? Math.round(
      databases.reduce((sum, db) => sum + db.frequency, 0) /
      databases.length,
    )
    : 0

  const maxCategoryCount = Math.max(
    1,
    ...categories.map(
      (category) =>
        databases.filter((db) => db.category === category).length,
    ),
  )

  const frequencyCounts = useMemo(
    () =>
      [...new Set(databases.map((db) => db.frequency))]
        .sort((a, b) => a - b)
        .map((frequency) => ({
          frequency,
          count: databases.filter(
            (db) => db.frequency === frequency,
          ).length,
        })),
    [databases],
  )

  const maxFrequencyCount = Math.max(
    1,
    ...frequencyCounts.map((item) => item.count),
  )

  const exportFilteredCsv = () => {
    const columns: {
      key: keyof ECGDatabase
      label: string
    }[] = [
        { key: 'id', label: 'id' },
        { key: 'name', label: 'dataset_name' },
        { key: 'records', label: 'records' },
        { key: 'frequency', label: 'sampling_frequency_hz' },
        { key: 'leads', label: 'leads' },
        { key: 'category', label: 'clinical_focus' },
        { key: 'source_url', label: 'official_source_url' },
        { key: 'description', label: 'description' },
        { key: 'license', label: 'license' },
        { key: 'last_verified', label: 'last_verified' },
      ]

    const escapeCsv = (value: unknown) => {
      const rawText = value == null ? '' : String(value)
      const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText
      return `"${text.replace(/"/g, '""')}"`
    }

    const csv = [
      columns.map((column) => escapeCsv(column.label)).join(','),
      ...filtered.map((db) =>
        columns
          .map((column) => escapeCsv(db[column.key]))
          .join(','),
      ),
    ].join('\r\n')

    const blob = new Blob(['\ufeff', csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `ekg-datasets-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!detailsDatabase) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailsDatabase(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () =>
      window.removeEventListener('keydown', handleKeyDown)
  }, [detailsDatabase])

  const resetFilters = () => {
    setSearch('')
    setMinFrequency('0')
    setSelectedCategory('all')
    setSelectedLeads('all')
    setSelectedLicense('all')
  }

  const toggleCompare = (id: number) => {
    setSelectedCompareIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  const openCreateForm = () => {
    setEditingId(null)
    setFormValues({
      ...emptyDatasetForm,
      last_verified: new Date().toISOString().slice(0, 10),
    })
    setFormError('')
    setCrudMessage('')
    setFormOpen(true)
  }

  const openEditForm = (db: ECGDatabase) => {
    setEditingId(db.id)

    setFormValues({
      name: db.name ?? '',
      records: String(db.records ?? 0),
      frequency: String(db.frequency ?? 250),
      leads: String(db.leads ?? 2),
      category: db.category ?? '',
      source_url: db.source_url ?? '',
      description: db.description ?? '',
      license: db.license ?? '',
      last_verified: db.last_verified ?? '',
    })

    setFormError('')
    setCrudMessage('')
    setFormOpen(true)
  }

  const getApiError = async (response: Response) => {
    try {
      const body = await response.json()

      if (typeof body.detail === 'string') {
        return body.detail
      }

      if (Array.isArray(body.detail)) {
        return body.detail
          .map((item: { msg?: string }) => item.msg)
          .filter(Boolean)
          .join(' ')
      }
    } catch {
      // Use the generic status message below.
    }

    return `Request failed (${response.status}).`
  }

  const loginAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminLoginError('')
    setIsLoggingIn(true)

    try {
      const response = await fetch(ADMIN_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      })

      if (!response.ok) {
        throw new Error(await getApiError(response))
      }

      const result = (await response.json()) as {
        token: string
        expires_in: number
      }

      setAdminToken(result.token)
      setAdminPassword('')
      setAdminLoginOpen(false)
      setAdminLoginError('')
      setCrudMessage(
        'Admin mode enabled. You can now add, edit, and delete catalog entries.',
      )
    } catch (error) {
      setAdminLoginError(
        error instanceof Error ? error.message : 'Admin login failed.',
      )
    } finally {
      setIsLoggingIn(false)
    }
  }

  const logoutAdmin = () => {
    const token = adminToken

    setAdminToken(null)
    setAdminPassword('')
    setFormOpen(false)
    setDeleteTarget(null)
    setCrudMessage('Admin mode disabled. The catalog is now read-only.')

    if (token) {
      void fetch(`${API_BASE_URL}/admin/logout`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      }).catch(() => undefined)
    }
  }

  const saveDataset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setCrudMessage('')

    const records = Number(formValues.records)
    const frequency = Number(formValues.frequency)
    const leads = Number(formValues.leads)

    if (!formValues.name.trim() || !formValues.category.trim()) {
      setFormError('Dataset name and clinical focus are required.')
      return
    }

    if (
      !Number.isInteger(records) ||
      records < 0 ||
      !Number.isInteger(frequency) ||
      frequency <= 0 ||
      !Number.isInteger(leads) ||
      leads <= 0
    ) {
      setFormError(
        'Records must be 0 or greater; frequency and leads must be positive whole numbers.',
      )
      return
    }

    const payload = {
      name: formValues.name.trim(),
      records,
      frequency,
      leads,
      category: formValues.category.trim(),
      source_url: formValues.source_url.trim(),
      description: formValues.description.trim(),
      license: formValues.license.trim() || null,
      last_verified: formValues.last_verified || null,
    }

    setIsSaving(true)

    try {
      const response = await fetch(
        editingId === null ? API_URL : `${API_URL}/${editingId}`,
        {
          method: editingId === null ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken ?? '',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        throw new Error(await getApiError(response))
      }

      const saved = (await response.json()) as ECGDatabase

      setDatabases((current) => {
        const next =
          editingId === null
            ? [...current, saved]
            : current.map((db) => (db.id === saved.id ? saved : db))

        return next.sort((a, b) => a.name.localeCompare(b.name))
      })

      setCrudMessage(
        editingId === null
          ? `“${saved.name}” was added to the catalog.`
          : `“${saved.name}” was updated.`,
      )

      setApiStatus('Connected')
      setFormOpen(false)
      setEditingId(null)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The dataset could not be saved.'

      if (
        message.toLowerCase().includes('admin login') ||
        message.includes('(401)')
      ) {
        setAdminToken(null)
      }

      setFormError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteDataset = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setCrudMessage('')

    try {
      const response = await fetch(`${API_URL}/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Token': adminToken ?? '',
        },
      })

      if (!response.ok) {
        throw new Error(await getApiError(response))
      }

      const deletedId = deleteTarget.id
      const deletedName = deleteTarget.name

      setDatabases((current) =>
        current.filter((db) => db.id !== deletedId),
      )

      setSelectedCompareIds((current) =>
        current.filter((id) => id !== deletedId),
      )

      setDeleteTarget(null)
      setCrudMessage(`“${deletedName}” was deleted from the catalog.`)
      setApiStatus('Connected')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The dataset could not be deleted.'

      if (
        message.toLowerCase().includes('admin login') ||
        message.includes('(401)')
      ) {
        setAdminToken(null)
      }

      setCrudMessage(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const pageTitles: Record<Page, string> = {
    catalog: 'Database catalog',
    compare: 'Compare datasets',
    statistics: 'Statistics',
  }
  const detailsSourceUrl = detailsDatabase
    ? safeExternalUrl(detailsDatabase.source_url)
    : null

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            setActivePage('catalog')
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36" role="img">
              <path d="M4 19h7l4-9 6 17 4-10h7" />
            </svg>
          </span>
          <span>
            EKG <strong>Explorer</strong>
          </span>
        </a>

        <div className="sidebar-section-label">Workspace</div>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${activePage === 'catalog' ? 'active' : ''}`}
            onClick={() => setActivePage('catalog')}
          >
            <span className="nav-symbol" aria-hidden="true">▤</span>
            <span>Database catalog</span>
          </button>

          <button
            className={`nav-item ${activePage === 'compare' ? 'active' : ''}`}
            onClick={() => setActivePage('compare')}
          >
            <span className="nav-symbol" aria-hidden="true">⇄</span>
            <span>Compare datasets</span>
            {selectedCompareIds.length > 0 && (
              <span className="nav-count">{selectedCompareIds.length}</span>
            )}
          </button>

          <button
            className={`nav-item ${activePage === 'statistics' ? 'active' : ''}`}
            onClick={() => setActivePage('statistics')}
          >
            <span className="nav-symbol" aria-hidden="true">▥</span>
            <span>Statistics</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div
            className={`connection-mark ${apiStatus === 'Connected' ? 'is-connected' : ''
              }`}
          />
          <div>
            <strong>{apiStatus}</strong>
            <span>Metadata API</span>
          </div>
          <span className="sidebar-version">v0.7</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Research workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{pageTitles[activePage]}</strong>
          </div>

          <div className="topbar-actions">
            <div
              className={`api-status ${apiStatus === 'Connected' ? 'connected' : ''
                }`}
            >
              <span className="status-dot" />
              API {apiStatus.toLowerCase()}
            </div>

            {adminToken ? (
              <button
                type="button"
                className="admin-access-button admin-enabled"
                onClick={logoutAdmin}
              >
                <span className="admin-lock-icon" aria-hidden="true">◆</span>
                Admin mode · Log out
              </button>
            ) : (
              <button
                type="button"
                className="admin-access-button"
                onClick={() => {
                  setAdminLoginError('')
                  setAdminLoginOpen(true)
                }}
              >
                <span className="admin-lock-icon" aria-hidden="true">▣</span>
                Admin login
              </button>
            )}
          </div>
        </header>

        <div className="page-content">
          <section className="page-intro">
            <div>
              <h1>
                {activePage === 'catalog'
                  ? 'EKG MetaData Explorer'
                  : pageTitles[activePage]}
              </h1>

              <p>
                {activePage === 'catalog'
                  ? 'Find open electrocardiogram datasets by the metadata that matters to your research.'
                  : activePage === 'compare'
                    ? 'Compare the structure and access conditions of selected ECG datasets.'
                    : 'A live overview of the metadata currently available in your catalog.'}
              </p>
            </div>

            <div className="intro-mark" aria-hidden="true">
              <svg viewBox="0 0 170 80">
                <path d="M0 43h32l12-23 18 43 17-32 10 12h17l9-22 13 22h32" />
              </svg>
            </div>
          </section>

          {loading && (
            <div className="notice">
              <span className="loading-spinner" />
              Loading datasets from the API…
            </div>
          )}

          {loadError && (
            <div className="notice notice-error" role="alert">
              <strong>Unable to load data</strong>
              <span>{loadError}</span>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}

          {!loading && !loadError && (
            <>
              {activePage === 'catalog' && (
                <>
                  <section
                    className="catalog-summary"
                    aria-label="Filtered catalog summary"
                  >
                    <div className="summary-item">
                      <span>Datasets in view</span>
                      <strong>
                        {filtered.length}
                        <small> / {databases.length}</small>
                      </strong>
                    </div>

                    <div className="summary-item">
                      <span>Lead configurations</span>
                      <strong>
                        {filtered.length
                          ? [...new Set(filtered.map((db) => db.leads))]
                            .sort((a, b) => a - b)
                            .join(', ')
                          : '—'}
                        <small>{filtered.length ? ' leads' : ''}</small>
                      </strong>
                    </div>

                    <div className="summary-item">
                      <span>Highest sampling rate</span>
                      <strong>
                        {filtered.length > 0 ? (
                          <>
                            {Math.max(...filtered.map((db) => db.frequency))}
                            <small> Hz</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </strong>
                    </div>
                  </section>

                  <section className="panel catalog-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>ECG database catalog</h2>
                          <p>
                            Search by dataset name, then narrow results with
                            metadata filters.
                          </p>
                          {!adminToken && (
                            <span className="read-only-note">
                              Read-only public catalog
                            </span>
                          )}
                        </div>

                        <div className="catalog-actions">
                          <span className="result-count">
                            {filtered.length}{' '}
                            {filtered.length === 1 ? 'dataset' : 'datasets'}
                          </span>

                          {adminToken && (
                            <button
                              type="button"
                              className="primary-action-button"
                              onClick={openCreateForm}
                            >
                              ＋ New dataset
                            </button>
                          )}

                          <button
                            type="button"
                            className="export-button"
                            onClick={exportFilteredCsv}
                            disabled={!filtered.length}
                          >
                            ↓ Export CSV
                          </button>
                        </div>
                      </div>

                      {crudMessage && (
                        <div className="crud-message" role="status">
                          {crudMessage}
                        </div>
                      )}

                      <div className="filter-area">
                        <div className="filter-main-row">
                          <div className="search-container">
                            <label className="search-box">
                              <span className="search-icon" aria-hidden="true">⌕</span>

                              <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') setSearch('')
                                  if (
                                    event.key === 'Enter' &&
                                    suggestions.length === 1
                                  ) {
                                    setSearch(suggestions[0].name)
                                  }
                                }}
                                placeholder="Search dataset names…"
                                role="combobox"
                                aria-expanded={suggestions.length > 0}
                                aria-controls="dataset-suggestions"
                                aria-autocomplete="list"
                              />

                              {search && (
                                <button
                                  type="button"
                                  className="clear-search"
                                  onClick={() => setSearch('')}
                                  aria-label="Clear search"
                                >
                                  ×
                                </button>
                              )}
                            </label>

                            {search.trim() && (
                              <div
                                id="dataset-suggestions"
                                className="search-suggestions"
                                role="listbox"
                              >
                                {suggestions.length ? (
                                  suggestions.map((db) => (
                                    <button
                                      type="button"
                                      className="suggestion-item"
                                      key={db.id}
                                      role="option"
                                      aria-selected={search === db.name}
                                      onClick={() => setSearch(db.name)}
                                    >
                                      <span className="suggestion-name">
                                        {db.name}
                                      </span>
                                      <span className="suggestion-details">
                                        {formatNumber(db.records)} records ·{' '}
                                        {db.frequency} Hz · {db.leads} leads
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="suggestion-empty">
                                    No dataset names match “{search.trim()}”.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <label className="frequency-filter">
                            <span>Minimum frequency</span>
                            <select
                              value={minFrequency}
                              onChange={(event) =>
                                setMinFrequency(event.target.value)
                              }
                            >
                              <option value="0">Any frequency</option>
                              <option value="250">250 Hz or more</option>
                              <option value="360">360 Hz or more</option>
                              <option value="500">500 Hz or more</option>
                            </select>
                          </label>
                        </div>

                        <div className="advanced-filters">
                          <label className="filter-field">
                            <span>Category</span>
                            <select
                              value={selectedCategory}
                              onChange={(event) =>
                                setSelectedCategory(event.target.value)
                              }
                            >
                              <option value="all">All categories</option>
                              {categories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="filter-field">
                            <span>Number of leads</span>
                            <select
                              value={selectedLeads}
                              onChange={(event) =>
                                setSelectedLeads(event.target.value)
                              }
                            >
                              <option value="all">All lead counts</option>
                              {leadOptions.map((leads) => (
                                <option key={leads} value={String(leads)}>
                                  {leads} leads
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="filter-field">
                            <span>License</span>
                            <select
                              value={selectedLicense}
                              onChange={(event) =>
                                setSelectedLicense(event.target.value)
                              }
                            >
                              <option value="all">All licenses</option>
                              {licenses.map((license) => (
                                <option key={license} value={license}>
                                  {license}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            className="reset-filters"
                            type="button"
                            onClick={resetFilters}
                            disabled={
                              !search &&
                              minFrequency === '0' &&
                              selectedCategory === 'all' &&
                              selectedLeads === 'all' &&
                              selectedLicense === 'all'
                            }
                          >
                            Reset filters
                          </button>
                        </div>
                      </div>

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Dataset</th>
                              <th className="numeric">Records*</th>
                              <th className="numeric">Sampling rate</th>
                              <th className="numeric">Leads</th>
                              <th>Clinical focus</th>
                              <th>License</th>
                              <th>Compare</th>
                              {adminToken && <th>Actions</th>}
                            </tr>
                          </thead>

                          <tbody>
                            {filtered.map((db) => (
                              <tr key={db.id}>
                                <td>
                                  <button
                                    type="button"
                                    className="dataset-detail-trigger"
                                    onClick={() => setDetailsDatabase(db)}
                                  >
                                    {db.name}
                                    <span aria-hidden="true"> ⓘ</span>
                                  </button>
                                  <small className="table-subtitle">
                                    ECG dataset
                                  </small>
                                </td>

                                <td className="numeric">
                                  {formatNumber(db.records)}
                                </td>
                                <td className="numeric">{db.frequency} Hz</td>
                                <td className="numeric">{db.leads}</td>
                                <td>
                                  <span className="category-value">
                                    {db.category}
                                  </span>
                                </td>
                                <td className="license-cell">{licenseName(db)}</td>
                                <td>
                                  <button
                                    className={`compare-toggle ${selectedCompareIds.includes(db.id)
                                      ? 'selected'
                                      : ''
                                      }`}
                                    onClick={() => toggleCompare(db.id)}
                                    aria-pressed={selectedCompareIds.includes(
                                      db.id,
                                    )}
                                  >
                                    {selectedCompareIds.includes(db.id)
                                      ? 'Added'
                                      : 'Add +'}
                                  </button>
                                </td>

                                {adminToken && (
                                  <td>
                                    <div className="row-actions">
                                      <button
                                        type="button"
                                        className="row-edit-button"
                                        onClick={() => openEditForm(db)}
                                        aria-label={`Edit ${db.name}`}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="row-delete-button"
                                        onClick={() => setDeleteTarget(db)}
                                        aria-label={`Delete ${db.name}`}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}

                            {!filtered.length && (
                              <tr>
                                <td
                                  colSpan={adminToken ? 8 : 7}
                                  className="empty-state"
                                >
                                  <strong>No matching datasets</strong>
                                  <span>
                                    Try a different name or reset the filters.
                                  </span>
                                  <button
                                    className="text-button"
                                    onClick={resetFilters}
                                  >
                                    Reset all filters
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="panel-footnote">
                        * Record counts and other metadata should be interpreted
                        according to each dataset’s official documentation.
                        Record counts do not necessarily equal patient counts.
                        “Not specified” means the license is not recorded in this
                        catalog; it does not mean the dataset is unrestricted.
                      </div>
                    </section>
                  </>
              )}

                  {activePage === 'compare' && (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Dataset comparison</h2>
                          <p>
                            Select datasets in the catalog to compare their
                            metadata side by side.
                          </p>
                        </div>
                        <span className="result-count">
                          {compareDatabases.length} selected
                        </span>
                      </div>

                      <div className="compare-picker">
                        <div>
                          <strong>Choose datasets</strong>
                          <span>
                            {selectedCompareIds.length < 2
                              ? 'Select at least two for a useful comparison.'
                              : 'Selected datasets are shown in the comparison below.'}
                          </span>
                        </div>

                        <div className="picker-options">
                          {databases.map((db) => (
                            <label key={db.id} className="picker-option">
                              <input
                                type="checkbox"
                                checked={selectedCompareIds.includes(db.id)}
                                onChange={() => toggleCompare(db.id)}
                              />
                              <span>{db.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {compareDatabases.length ? (
                        <div className="table-wrapper compare-table-wrapper">
                          <table className="comparison-table">
                            <thead>
                              <tr>
                                <th>Metadata</th>
                                {compareDatabases.map((db) => {
                                  const sourceUrl = safeExternalUrl(db.source_url)

                                  return (
                                    <th key={db.id}>
                                      {sourceUrl ? (
                                        <a
                                          className="dataset-name-link"
                                          href={sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          {db.name} ↗
                                        </a>
                                      ) : (
                                        db.name
                                      )}
                                    </th>
                                  )
                                })}
                              </tr>
                            </thead>

                            <tbody>
                              <tr>
                                <th scope="row">Records*</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id} className="numeric">
                                    {formatNumber(db.records)}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">Sampling frequency</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id} className="numeric">
                                    {db.frequency} Hz
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">Number of leads</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id} className="numeric">
                                    {db.leads}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">Clinical focus</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id}>{db.category || '—'}</td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">License</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id} className="license-cell">
                                    {licenseName(db)}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">Last verified</th>
                                {compareDatabases.map((db) => (
                                  <td key={db.id}>
                                    {db.last_verified || 'Not recorded'}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <th scope="row">LightWAVE</th>
                                {compareDatabases.map((db) => {
                                  const url = lightwaveUrl(db.lightwave_database_id)

                                  return (
                                    <td key={db.id}>
                                      {url ? (
                                        <a
                                          className="secondary-button"
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Open in LightWAVE ↗
                                        </a>
                                      ) : (
                                        'Not available'
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state compare-empty">
                          <strong>No datasets selected</strong>
                          <span>
                            Choose one or more datasets above, or return to the
                            catalog.
                          </span>
                          <button
                            className="text-button"
                            onClick={() => setActivePage('catalog')}
                          >
                            Open catalog
                          </button>
                        </div>
                      )}

                      <div className="panel-footnote">
                        * A dataset’s record count is not necessarily the number
                        of unique patients. Follow the official documentation
                        before using metadata in a study.
                      </div>
                    </section>
                  )}

                  {activePage === 'statistics' && (
                    <>
                      <section className="catalog-summary statistics-summary">
                        <div className="summary-item">
                          <span>Total datasets</span>
                          <strong>{databases.length}</strong>
                          <small>Loaded from the API</small>
                        </div>
                        <div className="summary-item">
                          <span>Sum of reported records*</span>
                          <strong>{formatNumber(totalRecords)}</strong>
                          <small>Across all catalog entries</small>
                        </div>
                        <div className="summary-item">
                          <span>Average sampling rate</span>
                          <strong>
                            {databases.length ? (
                              <>
                                {averageFrequency} <small>Hz</small>
                              </>
                            ) : (
                              '—'
                            )}
                          </strong>
                          <small>Unweighted dataset average</small>
                        </div>
                      </section>

                      <div className="analytics-grid">
                        <section className="panel chart-panel">
                          <div className="panel-heading">
                            <div>
                              <h2>Datasets by clinical focus</h2>
                              <p>
                                Number of catalog entries in each category.
                              </p>
                            </div>
                          </div>

                          <div className="bar-chart">
                            {categories.map((category) => {
                              const count = databases.filter(
                                (db) => db.category === category,
                              ).length

                              return (
                                <div className="bar-row" key={category}>
                                  <div className="bar-label">
                                    <span>{category}</span>
                                    <strong>{count}</strong>
                                  </div>
                                  <div className="bar-track">
                                    <div
                                      className="bar-fill"
                                      style={{
                                        width: `${(count / maxCategoryCount) * 100
                                          }%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}

                            {!categories.length && (
                              <p className="chart-empty">
                                No category data available.
                              </p>
                            )}
                          </div>
                        </section>

                        <section className="panel chart-panel">
                          <div className="panel-heading">
                            <div>
                              <h2>Sampling frequency</h2>
                              <p>
                                How often each sampling rate appears.
                              </p>
                            </div>
                          </div>

                          <div className="frequency-chart">
                            {frequencyCounts.map(({ frequency, count }) => (
                              <div
                                className="frequency-column"
                                key={frequency}
                              >
                                <strong>{count}</strong>
                                <div className="frequency-bar-track">
                                  <div
                                    className="frequency-bar"
                                    style={{
                                      height: `${(count / maxFrequencyCount) * 100
                                        }%`,
                                    }}
                                  />
                                </div>
                                <span>{frequency} Hz</span>
                              </div>
                            ))}

                            {!frequencyCounts.length && (
                              <p className="chart-empty">
                                No frequency data available.
                              </p>
                            )}
                          </div>
                        </section>
                      </div>

                      <section className="panel verification-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Metadata verification</h2>
                            <p>
                              Recorded license and last verification date for
                              each dataset.
                            </p>
                          </div>
                          <span className="result-count">
                            {
                              databases.filter((db) => db.last_verified).length
                            }{' '}
                            dated records
                          </span>
                        </div>

                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Dataset</th>
                                <th>License</th>
                                <th>Last verified</th>
                                <th>Official source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {databases.map((db) => {
                                const sourceUrl = safeExternalUrl(db.source_url)

                                return (
                                <tr key={db.id}>
                                  <td>
                                    <strong className="table-name">
                                      {db.name}
                                    </strong>
                                  </td>
                                  <td className="license-cell">
                                    {licenseName(db)}
                                  </td>
                                  <td>{db.last_verified || 'Not recorded'}</td>
                                  <td>
                                    {sourceUrl ? (
                                      <a
                                        className="source-link"
                                        href={sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Open source ↗
                                      </a>
                                    ) : (
                                      'Not recorded'
                                    )}
                                  </td>
                                </tr>
                                )
                              })}
                              {!databases.length && (
                                <tr>
                                  <td colSpan={4} className="empty-state">
                                    No datasets available.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="panel-footnote">
                          * The sum combines reported record counts from different
                          datasets. It should not be interpreted as a count of
                          unique people or unique ECG recordings across the
                          sources.
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}
            </div>
      </section>

      {adminLoginOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isLoggingIn
            ) {
              setAdminLoginOpen(false)
            }
          }}
        >
          <section
            className="dataset-modal admin-login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">Restricted access</span>
                <h2 id="admin-login-title">Administrator login</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAdminLoginOpen(false)}
                disabled={isLoggingIn}
                aria-label="Close admin login"
              >
                ×
              </button>
            </div>

            <p className="modal-description">
              The public catalog is read-only. Sign in with the administrator
              password to add, edit, or remove dataset metadata.
            </p>

            <form className="dataset-form" onSubmit={loginAdmin}>
              <label className="form-field form-field-wide">
                <span>Admin password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Enter administrator password"
                />
              </label>

              {adminLoginError && (
                <div className="form-error" role="alert">
                  {adminLoginError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setAdminLoginOpen(false)}
                  disabled={isLoggingIn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-link"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {formOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSaving
            ) {
              setFormOpen(false)
            }
          }}
        >
          <section
            className="dataset-modal dataset-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">Catalog management</span>
                <h2 id="dataset-form-title">
                  {editingId === null ? 'Add dataset' : 'Edit dataset'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setFormOpen(false)}
                disabled={isSaving}
                aria-label="Close dataset form"
              >
                ×
              </button>
            </div>

            <p className="modal-description">
              Enter metadata from the dataset’s official documentation.
              Saving writes the record to the SQLite database.
            </p>

            <form className="dataset-form" onSubmit={saveDataset}>
              <label className="form-field form-field-wide">
                <span>Dataset name *</span>
                <input
                  required
                  maxLength={200}
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues({ ...formValues, name: event.target.value })
                  }
                  placeholder="e.g. MIT-BIH Arrhythmia Database"
                />
              </label>

              <div className="form-grid">
                <label className="form-field">
                  <span>Records *</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={formValues.records}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        records: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Sampling frequency (Hz) *</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={formValues.frequency}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        frequency: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Number of leads *</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={formValues.leads}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        leads: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Clinical focus *</span>
                  <input
                    required
                    maxLength={150}
                    value={formValues.category}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        category: event.target.value,
                      })
                    }
                    placeholder="e.g. Arrhythmia"
                  />
                </label>
              </div>

              <label className="form-field form-field-wide">
                <span>Official source URL</span>
                <input
                  type="url"
                  maxLength={1000}
                  value={formValues.source_url}
                  onChange={(event) =>
                    setFormValues({
                      ...formValues,
                      source_url: event.target.value,
                    })
                  }
                  placeholder="https://…"
                />
              </label>

              <label className="form-field form-field-wide">
                <span>Description</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues({
                      ...formValues,
                      description: event.target.value,
                    })
                  }
                  placeholder="Short summary based on the official documentation"
                />
              </label>

              <div className="form-grid">
                <label className="form-field">
                  <span>License</span>
                  <input
                    maxLength={300}
                    value={formValues.license}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        license: event.target.value,
                      })
                    }
                    placeholder="e.g. CC BY 4.0"
                  />
                </label>

                <label className="form-field">
                  <span>Last verified</span>
                  <input
                    type="date"
                    value={formValues.last_verified}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        last_verified: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              {formError && (
                <div className="form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setFormOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-link"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : editingId === null
                      ? 'Save dataset'
                      : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isDeleting
            ) {
              setDeleteTarget(null)
            }
          }}
        >
          <section
            className="dataset-modal delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dataset-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">Confirm deletion</span>
                <h2 id="delete-dataset-title">Delete dataset?</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                aria-label="Close delete confirmation"
              >
                ×
              </button>
            </div>

            <p className="modal-description">
              You are about to delete <strong>{deleteTarget.name}</strong> from
              this catalog. This removes its metadata record from the SQLite
              database. This action cannot be undone.
            </p>

            {crudMessage && (
              <div className="form-error" role="alert">
                {crudMessage}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-action-button"
                onClick={deleteDataset}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </section>
        </div>
      )}

      {detailsDatabase && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetailsDatabase(null)
            }
          }}
        >
          <section
            className="dataset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">Dataset details</span>
                <h2 id="dataset-modal-title">{detailsDatabase.name}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetailsDatabase(null)}
                aria-label="Close dataset details"
              >
                ×
              </button>
            </div>

            <p className="modal-description">
              {detailsDatabase.description ||
                'No description has been recorded for this dataset yet.'}
            </p>

            <dl className="detail-grid">
              <div>
                <dt>Reported records</dt>
                <dd>
                  {formatNumber(detailsDatabase.records)}
                  {detailsDatabase.records_label
                    ? ` (${detailsDatabase.records_label})`
                    : ''}
                </dd>
              </div>
              {detailsDatabase.subject_count !== null &&
                detailsDatabase.subject_count !== undefined && (
                  <div>
                    <dt>Subjects</dt>
                    <dd>{formatNumber(detailsDatabase.subject_count)}</dd>
                  </div>
                )}
              <div>
                <dt>Sampling frequency</dt>
                <dd>{detailsDatabase.frequency} Hz</dd>
              </div>
              <div>
                <dt>Number of leads</dt>
                <dd>{detailsDatabase.leads}</dd>
              </div>
              <div>
                <dt>Clinical focus</dt>
                <dd>{detailsDatabase.category || 'Not specified'}</dd>
              </div>
              <div>
                <dt>License recorded in catalog</dt>
                <dd>{licenseName(detailsDatabase)}</dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>{detailsDatabase.last_verified || 'Not recorded'}</dd>
              </div>
              {detailsDatabase.duration && (
                <div>
                  <dt>Recording duration</dt>
                  <dd>{detailsDatabase.duration}</dd>
                </div>
              )}
              {detailsDatabase.file_format && (
                <div>
                  <dt>File format</dt>
                  <dd>{detailsDatabase.file_format}</dd>
                </div>
              )}
              {detailsDatabase.annotations && (
                <div>
                  <dt>Annotations</dt>
                  <dd>{detailsDatabase.annotations}</dd>
                </div>
              )}
              {detailsDatabase.access_conditions && (
                <div>
                  <dt>Access conditions</dt>
                  <dd>{detailsDatabase.access_conditions}</dd>
                </div>
              )}
            </dl>



            <div className="modal-note">
              Record counts do not necessarily equal the number of unique
              patients. Check the dataset’s official documentation and license
              before reuse.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  toggleCompare(detailsDatabase.id)
                  setDetailsDatabase(null)
                  setActivePage('compare')
                }}
              >
                {selectedCompareIds.includes(detailsDatabase.id)
                  ? 'Remove from comparison'
                  : 'Add to comparison'}
              </button>

              {detailsSourceUrl && (
                <a
                  className="primary-link"
                  href={detailsSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open official source ↗
                </a>
              )}
              {lightwaveUrl(detailsDatabase.lightwave_database_id) && (
                <a
                  className="secondary-button"
                  href={lightwaveUrl(detailsDatabase.lightwave_database_id) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in LightWAVE ↗
                </a>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
