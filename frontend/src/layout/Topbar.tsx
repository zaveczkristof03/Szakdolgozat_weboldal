/** Felső sáv: hol vagyunk (morzsamenü), API-állapot és admin be-/kijelentkezés. */
type Props = { title: string; apiStatus: string; isAdmin: boolean; onLogin: () => void; onLogout: () => void }

export default function Topbar({ title, apiStatus, isAdmin, onLogin, onLogout }: Props) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Research workspace</span>
        <span className="crumb-slash">/</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-actions">
        <div className={`api-status ${apiStatus === 'Connected' ? 'connected' : ''}`}>
          <span className="status-dot" />
          API {apiStatus.toLowerCase()}
        </div>
        {isAdmin ? (
          <button type="button" className="admin-access-button admin-enabled" onClick={onLogout}>
            <span className="admin-lock-icon" aria-hidden="true">◆</span>
            Admin mode · Log out
          </button>
        ) : (
          <button type="button" className="admin-access-button" onClick={onLogin}>
            <span className="admin-lock-icon" aria-hidden="true">▣</span>
            Admin login
          </button>
        )}
      </div>
    </header>
  )
}
