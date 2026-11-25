/** Egységes üres állapot: mi történt, és mit tehet a felhasználó. */
import type { ReactNode } from 'react'

type Props = { title: string; children?: ReactNode; action?: { label: string; onClick: () => void } ; className?: string }

export default function EmptyState({ title, children, action, className = '' }: Props) {
  return (
    <div className={`feature-empty-state ${className}`}>
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action && <button type="button" className="text-button" onClick={action.onClick}>{action.label}</button>}
    </div>
  )
}
