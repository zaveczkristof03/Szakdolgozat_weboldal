/**
 * Adatbázis létrehozása / szerkesztése – MINDEN metaadatmezővel.
 * Az üresen hagyott mező hiányzóként mentődik; az űrlap nem tölt ki semmit magától.
 */
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api/client.ts'
import { emptyFormValues, formSections, formToPayload, formValuesFrom, type DatasetFormValues } from '../../domain/datasetForm.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Modal from '../../components/Modal.tsx'

type Props = {
  editing: ECGDatabase | null
  token: string
  onClose: () => void
  onSaved: (saved: ECGDatabase, created: boolean) => void
  onUnauthorized: () => void
}

export default function DatasetFormModal({ editing, token, onClose, onSaved, onUnauthorized }: Props) {
  const [values, setValues] = useState<DatasetFormValues>(() => (editing ? formValuesFrom(editing) : emptyFormValues()))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { payload, error: validationError } = formToPayload(values)
    if (!payload) {
      setError(validationError ?? 'Check the form.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const saved = editing ? await api.updateDataset(editing.id, payload, token) : await api.createDataset(payload, token)
      onSaved(saved, editing === null)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) onUnauthorized()
      setError(caught instanceof Error ? caught.message : 'The dataset could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="dataset-form-title" title={editing ? 'Edit dataset' : 'Add dataset'} onClose={onClose} closeDisabled={busy} className="dataset-form-modal" closeLabel="Close dataset form">
      <p className="modal-description">Enter metadata from the dataset’s official documentation. Leave a field empty when the value is not verified – it will be shown as “Not recorded”.</p>
      <form className="dataset-form" onSubmit={submit} noValidate>
        {formSections.map((section) => (
          <fieldset className="form-section" key={section.title}>
            <legend>{section.title}</legend>
            <div className="form-grid">
              {section.fields.map((field) => (
                <label key={field.key} className={`form-field ${field.type === 'textarea' || field.key === 'name' ? 'form-field-wide' : ''}`}>
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} maxLength={5000} value={values[field.key]} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      min={field.type === 'number' ? 0 : undefined}
                      step={field.type === 'number' ? 1 : undefined}
                      required={field.required}
                      autoFocus={field.key === 'name'}
                      value={values[field.key]}
                      onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                      placeholder={field.hint}
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-link" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save dataset'}</button>
        </div>
      </form>
    </Modal>
  )
}
