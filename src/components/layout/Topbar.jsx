import React from 'react'
import { PanelLeftClose, PanelLeftOpen, CalendarDays } from 'lucide-react'
import { TITLES, sectionOf } from './nav'

const todayLabel = () =>
  new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export default function Topbar({ page, actions, collapsed, onToggleSidebar }) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="tool-group">
          <button
            className="tool-btn"
            onClick={onToggleSidebar}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ToggleIcon size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="topbar-heading">
          <div className="topbar-eyebrow">{sectionOf(page)}</div>
          <div className="topbar-title">{TITLES[page] || page}</div>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="tool-group tool-group-text">
          <CalendarDays size={15} strokeWidth={1.8} />
          {todayLabel()}
        </div>
        {actions && <div className="tool-group tool-group-flush">{actions}</div>}
      </div>
    </div>
  )
}
