// src/pages/MainApp.jsx
import { useState, useContext } from 'react'
import { ProfilesContext } from '../contexts/ProfilesContext'
import Sidebar from '../components/Sidebar/Sidebar'
import TabBar from '../components/TabBar/TabBar'
import BottomNav from '../components/TabBar/BottomNav'
import ChatTab from '../components/Tabs/ChatTab'
import TodayTab from '../components/Tabs/TodayTab'
import ChartTab from '../components/Tabs/ChartTab'
import NumbersTab from '../components/Tabs/NumbersTab'
import MatchTab from '../components/Tabs/MatchTab'
import GitHubLink from '../components/shared/GitHubLink'
import ErrorBoundary from '../components/shared/ErrorBoundary'
import { BusyProvider } from '../contexts/BusyContext'
import { trackEvent } from '../lib/analytics'

const TAB_COMPONENTS = {
  chat: ChatTab,
  today: TodayTab,
  chart: ChartTab,
  numbers: NumbersTab,
  match: MatchTab,
}

export default function MainApp() {
  const [activeTab, setActiveTab] = useState('chat')
  const { activeProfile } = useContext(ProfilesContext)

  const changeTab = tab => {
    setActiveTab(tab)
    trackEvent('tab_view', { tab }) // usage analytics only — no birth data (see analytics.js)
  }

  const TabContent = TAB_COMPONENTS[activeTab] ?? ChatTab

  return (
    <BusyProvider>
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop profile name header */}
        <div className="hidden md:flex items-center px-4 py-3 border-b border-border bg-surface gap-3 flex-shrink-0">
          <span className="text-sm font-semibold text-text">{activeProfile?.name ?? '—'}</span>
          <span className="text-xs text-muted">{activeProfile?.dob ?? ''}</span>
          <GitHubLink className="ml-auto" />
        </div>

        {/* Tab bar (desktop) */}
        <div className="hidden md:flex flex-col flex-shrink-0">
          <TabBar activeTab={activeTab} onTabChange={changeTab} />
        </div>

        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-surface flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-text">{activeProfile?.name ?? '—'}</p>
            <p className="text-xs text-muted">{activeProfile?.dob ?? ''}</p>
          </div>
          <GitHubLink />
        </div>

        {/* Tab content — boundary keyed on the tab so switching tabs clears any error */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <ErrorBoundary key={activeTab}>
            <TabContent />
          </ErrorBoundary>
        </div>

        {/* Bottom nav (mobile) */}
        <div className="flex md:hidden flex-col flex-shrink-0">
          <BottomNav activeTab={activeTab} onTabChange={changeTab} />
        </div>
      </div>
    </div>
    </BusyProvider>
  )
}
