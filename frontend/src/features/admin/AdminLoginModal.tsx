/** Admin bejelentkező ablak. A jelszót csak a backend ismeri; a felület egy tokent kap vissza. */
import { useState, type FormEvent } from 'react'
import { api } from '../../api/client.ts'
import Modal from '../../components/Modal.tsx'

type Props = { onClose: () => void; onLoggedIn: (token: string) => void }

export default function AdminLoginModal({ onClose, onLoggedIn }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await api.login(password)
      onLoggedIn(result.token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Admin login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="admin-login-title" title="Administrator login" onClose={onClose} closeDisabled={busy} className="admin-login-modal" closeLabel="Close admin login">
      <p className="modal-description">The public catalog is read-only. Sign in with the administrator password to add, edit, or remove dataset metadata.</p>
      <form className="dataset-form" onSubmit={submit}>
        <label className="form-field form-field-wide">
          <span>Admin password</span>
          <input type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter administrator password" />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-link" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </Modal>
  )
}
