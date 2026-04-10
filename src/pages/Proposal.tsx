import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { taskSheet } from '../data/task_sheet.js'
import SummaryTab from '@/components/proposal/summary-tab'
import TimelineTab from '@/components/proposal/timeline-tab'
import ResourceTab from '@/components/proposal/resource-tab'
import GovernanceTab from '@/components/proposal/governance-tab'
import NewProposalModal from '@/components/proposal/NewProposalModal'
import { ChevronDown, Plus } from 'lucide-react'

type TabKey = 'summary' | 'timeline' | 'resource' | 'governance'

const tabs: { key: TabKey; label: string; icon: string; desc: string }[] = [
  { key: 'summary', label: 'Summary & Scope', icon: '📋', desc: 'Project details and AI summary' },
  { key: 'timeline', label: 'Timeline', icon: '📅', desc: 'Milestones and dates' },
  { key: 'resource', label: 'Resource Allocation', icon: '👥', desc: 'Internal and external matching' },
  { key: 'governance', label: 'Governance', icon: '📊', desc: 'Metrics, tasks, reviews' },
]

export default function Proposal() {
  const [projects, setProjects] = useState<any[]>(taskSheet.projects)
  const [selectedId, setSelectedId] = useState<number>(taskSheet.projects[0]?.['Project ID'] ?? 1)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [showNewProposal, setShowNewProposal] = useState(false)

  const selectedProject = projects.find(p => p['Project ID'] === selectedId) || projects[0]

  const handleProjectUpdate = (updated: any) => {
    setProjects(prev => prev.map(p => p['Project ID'] === updated['Project ID'] ? updated : p))
  }

  const getStatusBadge = (project: any) => {
    const ms = project['Milestones'] || []
    const total = ms.length
    if (total === 0) return { label: 'No Milestones', cls: 'bg-gray-50 text-gray-500 border-gray-200' }
    const done = ms.filter((m: any) => m['Current Status'] === 'Completed').length
    const atRisk = ms.filter((m: any) => m['Current Status'] === 'Delayed' || m['Current Status'] === 'On Hold').length
    if (atRisk > 0) return { label: 'At Risk', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    if (done === total) return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    return { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
  }

  const badge = getStatusBadge(selectedProject)

  return (
    <AppLayout>
      <Topbar title="Proposal Planning" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* ── Project Selector Header ────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Project picker */}
              <div className="relative">
                <button
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="text-base">📁</span>
                  {selectedProject?.['Project Name'] || 'Select Project'}
                  <ChevronDown size={14} className={`transition-transform ${showProjectPicker ? 'rotate-180' : ''}`} />
                </button>
                {showProjectPicker && (
                  <div className="absolute left-0 top-full mt-2 z-20 w-80 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Select Project</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {projects.map(p => {
                        const pBadge = getStatusBadge(p)
                        const isSelected = p['Project ID'] === selectedId
                        return (
                          <button
                            key={p['Project ID']}
                            onClick={() => { setSelectedId(p['Project ID']); setShowProjectPicker(false) }}
                            className={`w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{p['Project Name']}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{p['Client'] || 'Internal'} · {p['Project Type'] || '—'}</p>
                            </div>
                            <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pBadge.cls}`}>
                              {pBadge.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Project meta */}
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                {selectedProject?.['Client'] && (
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Client</p>
                    <p className="text-xs font-bold text-gray-900">{selectedProject['Client']}</p>
                  </div>
                )}
                {selectedProject?.['Delivery Manager'] && (
                  <div className="text-center pl-3 border-l border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Manager</p>
                    <p className="text-xs font-bold text-gray-900">{selectedProject['Delivery Manager']}</p>
                  </div>
                )}
                {selectedProject?.['Revenue Model'] && (
                  <div className="text-center pl-3 border-l border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Revenue</p>
                    <p className="text-xs font-bold text-gray-900">{selectedProject['Revenue Model']}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status badge + New Proposal button */}
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${badge.cls}`}>
                {badge.label}
              </span>
              <button
                onClick={() => setShowNewProposal(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 transition-colors shadow-sm"
              >
                <Plus size={14} /> New Proposal
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ──────────────────────────────────────── */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center rounded-lg px-3 py-3 transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="text-lg mb-0.5">{tab.icon}</span>
              <span className="text-xs font-bold">{tab.label}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────────────── */}
        <div onClick={() => showProjectPicker && setShowProjectPicker(false)}>
          {activeTab === 'summary' && (
            <SummaryTab project={selectedProject} onUpdate={handleProjectUpdate} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab project={selectedProject} onUpdate={handleProjectUpdate} />
          )}
          {activeTab === 'resource' && (
            <ResourceTab project={selectedProject} />
          )}
          {activeTab === 'governance' && (
            <GovernanceTab project={selectedProject} />
          )}
        </div>

      </div>

      <NewProposalModal
        open={showNewProposal}
        onClose={() => setShowNewProposal(false)}
        onSave={(newProject) => {
          setProjects(prev => [...prev, newProject])
          setSelectedId(newProject['Project ID'])
          setActiveTab('summary')
        }}
      />

    </AppLayout>
  )
}
