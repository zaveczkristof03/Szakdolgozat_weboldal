/**
 * Közös modális ablak (felugró párbeszédablak).
 *
 * Akadálymentesség: megnyitáskor a fókusz az ablakba kerül, a Tab billentyű az
 * ablakon belül marad, az Esc bezár, bezáráskor a fókusz visszatér oda, ahonnan
 * az ablakot megnyitották. Egy helyen van megírva, így minden ablak így viselkedik.
 */
import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  titleId: string
  title: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
  closeDisabled?: boolean
  closeLabel?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ titleId, title, onClose, children, className = '', closeDisabled = false, closeLabel = 'Close' }: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)

  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const autoFocus = dialog?.querySelector<HTMLElement>('[autofocus]') ?? dialog
    autoFocus?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) {
        event.stopPropagation()
        onCloseRef.current()
      }
      if (event.key === 'Tab' && dialog) {
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose()
      }}
    >
      <section ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={closeDisabled} aria-label={closeLabel}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
