/** Törlés megerősítése. Saját hibaüzenete van, így korábbi sikerüzenet nem jelenhet meg itt hibaként. */
import { useState } from 'react'
import { api, ApiError } from '../../api/client.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Modal from '../../components/Modal.tsx'

type Props = { target: ECGDatabase; token: string; onClose: () => void; onDeleted: (db: ECGDatabase) => void; onUnauthorized: () => void }

export default function DeleteDatasetModal({ target, token, onClose, onDeleted, onUnauthorized }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmDelete = async () => {
    setBusy(true)
    setError('')
    try {
      await api.deleteDataset(target.id, token)
      onDeleted(target)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) onUnauthorized()
      setError(caught instanceof Error ? caught.message : 'The dataset could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="delete-dataset-title" title="Delete dataset?" onClose={onClose} closeDisabled={busy} className="delete-confirm-modal" closeLabel="Close delete confirmation">
      <p className="modal-description">
        You are about to delete <strong>{target.name}</strong> from this catalog. This removes its metadata record from the SQLite database. This action cannot be undone.
      </p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy} autoFocus>Cancel</button>
        <button type="button" className="danger-action-button" onClick={confirmDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
      </div>
    </Modal>
  )
}
