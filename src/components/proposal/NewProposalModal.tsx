import { useState, useRef, useMemo, type ReactNode } from 'react'
import {
  X, Upload, FileText, Plus, Trash2, Search, ChevronRight, ChevronLeft,
  Check, AlertTriangle, Building2, Zap, Calendar, Users, CheckCircle2,
  HelpCircle, ChevronDown, ExternalLink, Edit2, Pencil
} from 'lucide-react'
import { extractProposalDocument, type ExtractedProposalResponse } from '@/lib/proposalExtractionApi'
import internalData from '../../data/internal_data.js'
import externalData from '../../data/external_data.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 'choose' | 'uploading' | 's1' | 's2' | 's3'

interface MilestoneRow {
  id: string
  name: string
  startDate: string
  endDate: string
}

interface ResourceRow {
  id: string
  role: string
  skills: string[]
  responsibilities: string
  bandwidth: number
}

interface Assignment {
  type: 'internal' | 'external'
  id: string // emp ID or name+company
  name: string
  subText?: string
  bw: number
  score: number
}

interface AllocResult {
  resourceId: string
  role: string
  requiredBW: number
  assignments: Assignment[]
  tbdBW: number
  status: 'matched' | 'partial'
}

// ─── GEHC sample extracted data ──────────────────────────────────────────────

const GEHC_DATA = {
  projectName: 'GE HealthCare – Axone LTS Automation',
  client: 'GE HealthCare',
  milestones: [
    { id: 'm1', name: 'Foundation complete', startDate: '2026-04-13', endDate: '2026-05-04' },
    { id: 'm2', name: 'LTS orchestration pipeline ready', startDate: '2026-05-05', endDate: '2026-06-08' },
    { id: 'm3', name: 'Remediation system complete', startDate: '2026-06-09', endDate: '2026-06-22' },
    { id: 'm4', name: 'Pilot success – all 27 components', startDate: '2026-06-22', endDate: '2026-06-22' },
    { id: 'm5', name: 'Production ready', startDate: '2026-06-23', endDate: '2026-06-29' },
    { id: 'm6', name: 'Full production deployment & KT', startDate: '2026-06-30', endDate: '2026-07-06' },
  ] as MilestoneRow[],
  resources: [
    { id: 'r1', role: 'Project Manager', skills: ['Project Management', 'Delivery Management', 'Stakeholder Management', 'Governance'], responsibilities: 'Planning, scheduling, milestone tracking, governance, stakeholder communication', bandwidth: 50 },
    { id: 'r2', role: 'Solution Architect', skills: ['Architecture', 'System Design', 'Enterprise Architecture', 'Tech Leadership'], responsibilities: 'Solution architecture, design authority, integration alignment', bandwidth: 25 },
    { id: 'r3', role: 'Senior Python Developer', skills: ['Python', 'CI/CD', 'Pipeline', 'DevOps'], responsibilities: 'DSL Library integration, log parsing, artifact promotion, pipeline integration', bandwidth: 100 },
    { id: 'r4', role: 'Senior DevOps Engineer', skills: ['DevOps', 'CI/CD', 'Jenkins', 'Docker', 'Kubernetes', 'Infrastructure'], responsibilities: 'CI/CD pipeline setup, environment management, build automation', bandwidth: 100 },
    { id: 'r5', role: 'DevOps Engineer', skills: ['DevOps', 'CI/CD', 'Docker', 'Automation', 'Monitoring'], responsibilities: 'CI/CD configuration, deployment scripts, monitoring setup', bandwidth: 100 },
    { id: 'r6', role: 'Business Analyst', skills: ['Business Analysis', 'Requirements', 'Documentation', 'Stakeholder Management'], responsibilities: 'Requirements gathering, business analysis, delivery validation', bandwidth: 30 },
    { id: 'r7', role: 'Quality Analyst', skills: ['QA', 'Testing', 'Automation', 'Acceptance Testing'], responsibilities: 'Test case design, quality assurance, acceptance testing', bandwidth: 50 },
  ] as ResourceRow[],
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function fmtDate(s: string): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function genId(): string {
  return Math.random().toString(36).slice(2, 8)
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function normalizeMilestonesFromExtracted(rows: ExtractedProposalResponse['proposal']['milestones']): MilestoneRow[] {
  if (!rows.length) return []

  const start = todayIso()
  let cursor = start
  return rows.slice(0, 12).map((row, idx) => {
    const normalizedStart = row.startDate || cursor
    const normalizedEnd = row.endDate || normalizedStart
    cursor = addDays(normalizedEnd, 1)
    return {
      id: row.id || `m${idx + 1}`,
      name: (row.name || `Milestone ${idx + 1}`).trim(),
      startDate: normalizedStart,
      endDate: normalizedEnd,
    }
  })
}

function normalizeResourcesFromExtracted(rows: ExtractedProposalResponse['proposal']['resources']): ResourceRow[] {
  if (!rows.length) return []
  return rows.slice(0, 12).map((row, idx) => ({
    id: row.id || `r${idx + 1}`,
    role: (row.role || '').trim(),
    skills: (row.skills || []).filter(Boolean).slice(0, 8),
    responsibilities: (row.responsibilities || '').trim(),
    bandwidth: Math.max(0, Math.min(100, Number(row.bandwidth || 100))),
  }))
}

function isIncompatibleDocument(warnings: string[]): boolean {
  return warnings.some(w => w.startsWith('INCOMPATIBLE_DOCUMENT:'))
}

function getIncompatibleMessage(warnings: string[]): string {
  const w = warnings.find(w => w.startsWith('INCOMPATIBLE_DOCUMENT:'))
  return w ? w.replace('INCOMPATIBLE_DOCUMENT: ', '') : ''
}

function scoreEmployee(emp: any, required: string[]): { score: number; matched: string[]; partial: string[] } {
  if (!required.length) return { score: 0, matched: [], partial: [] }
  const empSkills = (emp['Skills'] || '').toLowerCase().split(',').map((s: string) => s.trim())
  const matched: string[] = [], partial: string[] = []
  for (const req of required) {
    const r = req.toLowerCase().trim()
    if (empSkills.some((s: string) => s === r || s.includes(r) || r.includes(s))) {
      matched.push(req)
    } else if (empSkills.some((s: string) => s.split(' ').some((w: string) => w.length > 3 && r.includes(w)))) {
      partial.push(req)
    }
  }
  const score = Math.round(((matched.length + partial.length * 0.5) / required.length) * 100)
  return { score, matched, partial }
}

function scoreExternal(company: any, skills: string[]): { score: number; matched: string[]; partial: string[] } {
  if (!skills.length) return { score: 0, matched: [], partial: [] }
  const text = [
    company['Tech Stack'] || '',
    company['Domains'] || '',
    company['Strengths'] || '',
    company['Overview'] || '',
    company['Tools/Accelerators'] || '',
  ].join(' ').toLowerCase()

  const matched: string[] = [], partial: string[] = []
  for (const skill of skills) {
    const s = skill.toLowerCase().trim()
    if (text.includes(s)) {
      matched.push(skill)
    } else {
      const words = s.split(/\s+/)
      if (words.some(w => w.length > 3 && text.includes(w))) {
        partial.push(skill)
      }
    }
  }
  const score = Math.round(((matched.length + partial.length * 0.5) / skills.length) * 100)
  return { score, matched, partial }
}

function estAvailBW(emp: any, used: Record<number, number>): number {
  const count = (emp['Current Projects'] || '').split(',').filter((p: string) => p.trim()).length
  const base = Math.max(20, 100 - count * 20)
  return Math.max(0, base - (used[emp.ID] || 0))
}

function getTbdReason(alloc: AllocResult, res: ResourceRow): string {
  if (alloc.assignments.length > 0 && alloc.tbdBW > 0) {
    const names = alloc.assignments.map(a => a.name).join(' & ')
    return `${names} cover ${alloc.requiredBW - alloc.tbdBW}% — remaining ${alloc.tbdBW}% needs support`
  }
  if (alloc.tbdBW === 0) return `Resource requirements fully met for this role`
  const employees: any[] = (internalData as any).employees
  const hasSkillMatch = employees.some(emp => scoreEmployee(emp, res.skills).score >= 30)
  if (!hasSkillMatch) return `No internal fit found for ${res.role}`
  return `Internal resources are at capacity for the requested project timeline`
}

function getAllocationState(alloc: AllocResult): 'matched' | 'partial' | 'open' {
  if (alloc.tbdBW <= 0) return 'matched'
  if (alloc.assignments.length > 0) return 'partial'
  return 'open'
}

function getCoveragePct(alloc: AllocResult): number {
  if (alloc.requiredBW <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((alloc.requiredBW - alloc.tbdBW) / alloc.requiredBW) * 100)))
}

function runAutoAlloc(resources: ResourceRow[]): AllocResult[] {
  const usedBW: Record<number, number> = {}
  const assignedEmpIds = new Set<number>()
  const employees: any[] = (internalData as any).employees

  return resources.map(res => {
    const list: Assignment[] = []
    let open = res.bandwidth
    
    const candidates = employees
      .map(emp => ({ emp, ...scoreEmployee(emp, res.skills), avail: estAvailBW(emp, usedBW) }))
      .filter(c => c.score >= 50 && c.avail >= 20 && !assignedEmpIds.has(c.emp.ID))
      .sort((a, b) => b.score - a.score || b.avail - a.avail)

    if (candidates[0]) {
      const best = candidates[0]
      const alloc = Math.min(open, best.avail)
      list.push({
        type: 'internal',
        id: String(best.emp.ID),
        name: best.emp.Name,
        subText: best.emp.Department || 'Engineering',
        bw: alloc,
        score: best.score
      })
      usedBW[best.emp.ID] = (usedBW[best.emp.ID] || 0) + alloc
      assignedEmpIds.add(best.emp.ID)
      open -= alloc
    }

    return {
      resourceId: res.id,
      role: res.role,
      requiredBW: res.bandwidth,
      assignments: list,
      tbdBW: open,
      status: open <= 0 ? 'matched' : 'partial'
    }
  })
}

// ─── EmpCard ─────────────────────────────────────────────────────────────────

function EmpCard({ emp, score, matched, partial, avail, assignAction }: {
  emp: any; score: number; matched: string[]; partial: string[]; avail: number; assignAction?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const allSkills: string[] = (emp.Skills || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const bwColor = avail >= 60 ? 'bg-emerald-500' : avail >= 30 ? 'bg-amber-500' : 'bg-red-400'
  const scoreCls = score >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-orange-700 bg-orange-50 border-orange-200'
  const initials = emp.Name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')

  return (
    <div className={`rounded-xl border transition-all group/emp ${expanded ? 'border-blue-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'} bg-white`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">{emp.Name}</p>
            <span className={`text-sm font-bold rounded-full border px-2.5 py-0.5 flex-shrink-0 ${scoreCls}`}>{score}% match</span>
          </div>
          <p className="text-sm font-medium text-gray-700 truncate">{emp.Role}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[160px]">
          <div className="w-36">
            <div className="flex justify-between mb-0.5">
              <span className="text-sm text-gray-600 uppercase font-bold tracking-wide">Available</span>
              <span className="text-sm font-bold text-gray-800">{avail}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`h-full rounded-full ${bwColor}`} style={{ width: `${avail}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold text-gray-600">
            <span>{expanded ? 'Hide details' : 'View details'}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : 'rotate-0'}`} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Current Projects</p>
              <p className="text-gray-600 leading-relaxed">{emp['Current Projects'] || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Timeline Availability</p>
              <p className={avail > 50 ? 'text-emerald-600 font-semibold' : avail > 20 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold'}>
                {avail > 50 ? '✅ Fully available' : avail > 20 ? '⚠️ Limited capacity' : '❌ Near full capacity'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1.5">Skills</p>
            <div className="flex flex-wrap gap-1">
              {allSkills.map((skill: string) => {
                const sl = skill.toLowerCase()
                const isMatched = matched.some(m => sl.includes(m.toLowerCase()) || m.toLowerCase().includes(sl))
                const isPartial = !isMatched && partial.some(p => sl.includes(p.toLowerCase()) || p.toLowerCase().includes(sl))
                return (
                  <span key={skill} className={`text-sm font-medium rounded-full px-2 py-0.5 ${isMatched ? 'bg-emerald-100 text-emerald-700' :
                      isPartial ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-100 text-gray-500'
                    }`}>
                    {isMatched ? '✓ ' : isPartial ? '~ ' : ''}{skill}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {assignAction && (
        <div
          className={`px-3 pb-3 flex justify-end overflow-hidden transition-all duration-200 ${expanded
              ? 'max-h-14 opacity-100'
              : 'max-h-0 opacity-0 group-hover/emp:max-h-14 group-hover/emp:opacity-100 group-focus-within/emp:max-h-14 group-focus-within/emp:opacity-100'
            }`}
        >
          {assignAction}
        </div>
      )}
    </div>
  )
}

// ─── ExternalCard — same design as EmpCard, blue-themed ──────────────────────

function ExternalCard({ company, score, matched, partial, assigned, onAssign }: {
  company: any
  score: number
  matched: string[]
  partial: string[]
  assigned: boolean
  onAssign: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const techStack: string[] = (company['Tech Stack'] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const domains: string[] = (company['Domains'] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const companyName: string = company['Company Name'] || ''
  const contactName: string = company['Contact Person'] || ''
  const type: string = company['Type'] || 'External Partner'
  const isConsultant = type === 'External Consultant'
  const displayName = isConsultant ? contactName : companyName
  const initials = displayName.split(' ').filter((w: string) => w.length > 0).slice(0, 2).map((w: string) => w[0]).join('')

  const scoreCls = score >= 60 ? 'text-blue-700 bg-blue-50 border-blue-200'
    : score >= 35 ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
      : 'text-slate-600 bg-slate-50 border-slate-200'

  return (
    <div className={`rounded-xl border transition-all ${assigned ? 'border-blue-400 bg-blue-50/30 shadow-sm' :
        expanded ? 'border-blue-200 shadow-sm' :
          'border-gray-100 hover:border-blue-200 bg-white'
      } group/ext`}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0 border border-blue-200">
          {initials}
        </div>

        <div className="flex-1 min-w-0 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <span className={`text-sm font-bold rounded-full border px-2.5 py-0.5 flex-shrink-0 ${scoreCls}`}>{score}% match</span>
            <span className={`text-sm font-bold rounded-full px-2 py-0.5 uppercase tracking-wider ${isConsultant ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
              } border`}>{type}</span>
            {assigned && (
              <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 flex items-center gap-0.5">
                <Check size={9} /> Assigned
              </span>
            )}
          </div>
          {isConsultant && <p className="text-sm text-gray-600 font-medium">via {companyName}</p>}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[160px]">
          <div className="w-36">
            <div className="flex justify-between mb-0.5">
              <span className="text-sm text-gray-600 uppercase font-bold tracking-wide">Capacity</span>
              <span className="text-sm font-bold text-blue-600">Available</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-full rounded-full bg-blue-400" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="cursor-pointer flex items-center gap-1 text-sm font-semibold text-gray-600" onClick={() => setExpanded(e => !e)}>
            <span>{expanded ? 'Hide details' : 'View details'}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : 'rotate-0'}`} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Domains</p>
              <div className="flex flex-wrap gap-1">
                {domains.map(d => (
                  <span key={d} className="rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium px-2.5 py-0.5">{d}</span>
                ))}
                {domains.length === 0 && <p className="text-gray-400">—</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Engagement Model</p>
              <p className="text-sm text-gray-700 font-medium">{company['Engagement Model'] || '—'}</p>
              <p className="text-sm text-gray-500 mt-0.5">{company['Partnership Model'] || ''}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tech Stack</p>
            <div className="flex flex-wrap gap-1">
              {techStack.map((skill: string) => {
                const sl = skill.toLowerCase()
                const isMatched = matched.some(m => sl.includes(m.toLowerCase()) || m.toLowerCase().includes(sl))
                const isPartial = !isMatched && partial.some(p => sl.includes(p.toLowerCase()) || p.toLowerCase().includes(sl))
                return (
                  <span key={skill} className={`text-sm font-medium rounded-full px-2.5 py-0.5 ${isMatched ? 'bg-emerald-100 text-emerald-700' :
                      isPartial ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-100 text-gray-500'
                    }`}>
                    {isMatched ? '✓ ' : isPartial ? '~ ' : ''}{skill}
                  </span>
                )
              })}
              {techStack.length === 0 && <p className="text-sm text-gray-400">—</p>}
            </div>
          </div>

          {company['Overview'] && (
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Overview</p>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{company['Overview']}</p>
            </div>
          )}

          {company['Website'] && (
            <a href={company['Website']} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <ExternalLink size={10} /> {company['Website']}
            </a>
          )}
        </div>
      )}

        {!assigned && (
        <div
          className={`px-3 pb-3 flex justify-end overflow-hidden transition-all duration-200 ${expanded
              ? 'max-h-14 opacity-100'
              : 'max-h-0 opacity-0 group-hover/ext:max-h-14 group-hover/ext:opacity-100 group-focus-within/ext:max-h-14 group-focus-within/ext:opacity-100'
            }`}
        >
          <button
            onClick={onAssign}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3 py-1.5 transition-colors shadow-sm"
          >
            <Plus size={12} /> Assign
          </button>
        </div>
      )}

      {assigned && (
        <div className="px-3 pb-3 flex justify-end">
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold px-3 py-1.5">
            <CheckCircle2 size={13} /> Assigned
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface NewProposalModalProps {
  open: boolean
  onClose: () => void
  onSave: (project: any) => void
}

const STEP_LABELS = [
  { key: 's1', label: 'Extraction Review' },
  { key: 's2', label: 'Resource Search' },
  { key: 's3', label: 'Auto Allocation' },
]

export default function NewProposalModal({ open, onClose, onSave }: NewProposalModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<WizardStep>('choose')
  const [fileName, setFileName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [client, setClient] = useState('')
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [selectedResIdx, setSelectedResIdx] = useState(0)
  const [skillSearch, setSkillSearch] = useState('')
  const [activeSkillChip, setActiveSkillChip] = useState('')
  const [allocations, setAllocations] = useState<AllocResult[]>([])
  const [tbdAssigned, setTbdAssigned] = useState<Record<string, string>>({})
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null)
  const [selectedAllocId, setSelectedAllocId] = useState<string | null>(null)
  const [searchTab, setSearchTab] = useState<'Internal Team' | 'External Consultant' | 'External Partner'>('Internal Team')
  const [extractWarnings, setExtractWarnings] = useState<string[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)
  const [analysisMeta, setAnalysisMeta] = useState<{ processingMs: number; pages: number } | null>(null)

  const handleClose = () => {
    setStep('choose'); setFileName(''); setProjectName(''); setClient('')
    setMilestones([]); setResources([]); setSelectedResIdx(0)
    setSkillSearch(''); setActiveSkillChip(''); setAllocations([])
    setTbdAssigned({})
    setEditingMilestoneId(null); setEditingResourceId(null)
    setSelectedAllocId(null); setSearchTab('Internal Team')
    setExtractWarnings([]); setExtractError(null); setAnalysisMeta(null)
    onClose()
  }

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setExtractWarnings([])
    setExtractError(null)
    setAnalysisMeta(null)
    setStep('uploading')

    try {
      const extracted = await extractProposalDocument(file)
      const extractedMilestones = normalizeMilestonesFromExtracted(extracted.proposal?.milestones || [])
      const extractedResources = normalizeResourcesFromExtracted(extracted.proposal?.resources || [])

      setProjectName(extracted.proposal?.project_name || '')
      setClient(extracted.proposal?.client || '')
      setMilestones(extractedMilestones)
      setResources(extractedResources)
      setExtractWarnings(extracted.proposal?.warnings || [])
      setAnalysisMeta({
        processingMs: extracted.metadata?.processing_ms || 0,
        pages: extracted.metadata?.pages || 0,
      })
      setStep('s1')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document analysis failed'
      setExtractError(message)
      setProjectName('')
      setClient('')
      setMilestones([])
      setResources([])
      setExtractWarnings([])
      setStep('s1')
    }
  }

  const updateMilestone = (idx: number, field: keyof MilestoneRow, value: string) => {
    setMilestones(prev => {
      const rows = prev.map(r => ({ ...r }))
      const oldRow = rows[idx]

      if (field === 'startDate') {
        const dur = daysBetween(oldRow.startDate, oldRow.endDate)
        const newStart = value
        const newEnd = addDays(newStart, dur)
        rows[idx] = { ...rows[idx], startDate: newStart, endDate: newEnd }
      } else if (field === 'endDate') {
        rows[idx] = { ...rows[idx], endDate: value }
      } else {
        rows[idx] = { ...rows[idx], [field]: value }
      }

      if (field === 'startDate' || field === 'endDate') {
        let lastEnd = rows[idx].endDate
        for (let i = idx + 1; i < rows.length; i++) {
          const dur = daysBetween(rows[i].startDate, rows[i].endDate)
          const newStart = addDays(lastEnd, 1)
          const newEnd = addDays(newStart, Math.max(0, dur))
          rows[i] = { ...rows[i], startDate: newStart, endDate: newEnd }
          lastEnd = newEnd
        }
      }

      return rows
    })
  }

  const addMilestone = () => {
    const last = milestones[milestones.length - 1]
    const start = last ? addDays(last.endDate, 1) : new Date().toISOString().split('T')[0]
    setMilestones(prev => [...prev, { id: genId(), name: 'New Milestone', startDate: start, endDate: addDays(start, 6) }])
  }

  const delMilestone = (id: string) => setMilestones(prev => prev.filter(m => m.id !== id))

  const updateResource = (idx: number, field: keyof ResourceRow, value: any) =>
    setResources(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const addResource = () =>
    setResources(prev => [...prev, { id: genId(), role: '', skills: [], responsibilities: '', bandwidth: 100 }])

  const delResource = (id: string) => setResources(prev => prev.filter(r => r.id !== id))

  const addSkill = (idx: number, skill: string) => {
    const s = skill.trim()
    if (!s) return
    setResources(prev => prev.map((r, i) => i === idx ? { ...r, skills: [...r.skills, s] } : r))
  }

  const removeSkill = (resIdx: number, skill: string) =>
    setResources(prev => prev.map((r, i) => i === resIdx ? { ...r, skills: r.skills.filter(s => s !== skill) } : r))

  const selectedRes = resources[selectedResIdx]

  const effectiveTerms = useMemo(() => {
    if (skillSearch) return [skillSearch.toLowerCase()]
    if (activeSkillChip) return [activeSkillChip.toLowerCase()]
    return (selectedRes?.skills || []).map((s: string) => s.toLowerCase())
  }, [skillSearch, activeSkillChip, selectedRes])

  const filteredEmps = useMemo(() => {
    const employees: any[] = (internalData as any).employees
    if (!effectiveTerms.length) return employees
    return employees.filter((emp: any) =>
      effectiveTerms.some(term =>
        (emp['Skills'] || '').toLowerCase().includes(term) ||
        (emp['Role'] || '').toLowerCase().includes(term)
      )
    )
  }, [effectiveTerms])

  const proceedToStep3 = () => {
    const fresh = runAutoAlloc(resources)
    setAllocations(fresh)
    setTbdAssigned({})
    setSelectedAllocId(fresh[0]?.resourceId || null)
    setSearchTab('Internal Team')
    setStep('s3')
  }

  const assignInternalS3 = (resourceId: string, emp: any) => {
    setAllocations(prev => prev.map(a => {
      if (a.resourceId !== resourceId) return a
      if (a.tbdBW <= 0) return a
      
      const skills = resources.find(r => r.id === resourceId)?.skills || []
      const { score } = scoreEmployee(emp, skills)
      const avail = estAvailBW(emp, {}) 
      const allocBW = Math.min(avail, a.tbdBW)
      
      const newAssign: Assignment = {
        type: 'internal',
        id: String(emp.ID),
        name: emp.Name,
        subText: emp.Department || 'Professional Services',
        bw: allocBW,
        score
      }

      const updated = [...a.assignments, newAssign].sort((a, b) => b.bw - a.bw)
      const newTbd = Math.max(0, a.tbdBW - allocBW)
      return {
        ...a,
        assignments: updated,
        tbdBW: newTbd,
        status: newTbd <= 0 ? 'matched' : 'partial'
      }
    }))
  }

  const assignExternal = (resourceId: string, company: any) => {
    setAllocations(prev => prev.map(a => {
      if (a.resourceId !== resourceId) return a
      if (a.tbdBW <= 0) return a

      const skills = resources.find(r => r.id === resourceId)?.skills || []
      const { score } = scoreExternal(company, skills)
      const allocBW = a.tbdBW 
      
      const newAssign: Assignment = {
        type: 'external',
        id: company['Company Name'] + (company['Contact Person'] || ''),
        name: company['Contact Person'] || company['Company Name'],
        subText: company['Type'] === 'External Consultant' ? company['Company Name'] : 'Partner Firm',
        bw: allocBW,
        score
      }

      const updated = [...a.assignments, newAssign]
      return {
        ...a,
        assignments: updated,
        tbdBW: 0,
        status: 'matched'
      }
    }))
    setTbdAssigned(prev => ({ ...prev, [resourceId]: company['Company Name'] }))
  }

  const removeAssignment = (resourceId: string, assignmentId: string) => {
    setAllocations(prev => prev.map(a => {
      if (a.resourceId !== resourceId) return a
      const removing = a.assignments.find(as => as.id === assignmentId)
      if (!removing) return a
      
      const updated = a.assignments.filter(as => as.id !== assignmentId)
      const newTbd = a.tbdBW + removing.bw
      
      return {
        ...a,
        assignments: updated,
        tbdBW: newTbd,
        status: 'partial'
      }
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    onSave({
      'Project ID': Date.now(),
      'Project Name': projectName || 'New Project',
      'Client': client || null,
      'Project Type': 'New Proposal',
      'Delivery Manager': 'Unassigned',
      'Revenue Model': 'Milestone',
      'Resource Aligned': allocations.map(a => a.assignments.map(as => as.name).join(', ')).filter(Boolean).join(', ') || 'TBD',
      'Handled By': 'Hybrid Team',
      'Add Info': '',
      // Formatted milestones (for display on Proposal page)
      'Milestones': milestones.map((m, i) => ({
        'Milestone': `M${i + 1}`,
        'Milestone Description': m.name,
        'Planned Start': fmtDate(m.startDate),
        'Planned End': fmtDate(m.endDate),
        '% Complete': 0,
        'Current Status': 'Not Started',
        'Invoice Status': 'Pending',
      })),
      // Raw ISO milestones for DB insertion (used by Projects page)
      '_rawMilestones': milestones.map((m, i) => ({
        code: `M${i + 1}`,
        description: m.name,
        plannedStart: m.startDate,  // YYYY-MM-DD
        plannedEnd: m.endDate,      // YYYY-MM-DD
      })),
      '_allocations': allocations,
    })
    handleClose()
  }

  if (!open) return null

  const currentStepIdx = STEP_LABELS.findIndex(s => s.key === step)
  const selectedAllocation = allocations.find(a => a.resourceId === selectedAllocId) || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative w-[96vw] max-w-[1520px] h-[96vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Proposal</h2>
            {fileName && <p className="text-xs text-gray-400 mt-0.5">Parsed from: {fileName}</p>}
          </div>

          {currentStepIdx >= 0 && (
            <div className="flex items-center gap-1.5">
              {STEP_LABELS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${i < currentStepIdx ? 'bg-emerald-100 text-emerald-700' :
                      i === currentStepIdx ? 'bg-blue-600 text-white shadow-sm' :
                        'bg-gray-200 text-gray-700'
                    }`}>
                    {i < currentStepIdx ? <Check size={10} /> : <span className="w-3 text-center">{i + 1}</span>}
                    {s.label}
                  </div>
                  {i < STEP_LABELS.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
                </div>
              ))}
            </div>
          )}

          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ══ CHOOSE ══════════════════════════════════════════════════════════ */}
          {step === 'choose' && (
            <div className="min-h-full flex flex-col items-center justify-center px-8 py-10">
              <div className="w-full max-w-2xl text-center">
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Upload Project Brief</h3>
              <p className="text-gray-500 text-base mb-10 mx-auto max-w-xl leading-relaxed">
                Upload a project brief to auto-extract milestones, resources, and required skills using AI.
              </p>
              <div className="flex justify-center w-full max-w-xl mx-auto">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/30 p-14 hover:bg-blue-50 hover:border-blue-400 transition-all group text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Upload size={34} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">Upload Document</p>
                    <p className="text-sm text-gray-500 mt-1.5">HTML · PDF · DOCX<br />AI extracts milestones, resources & skills</p>
                  </div>
                  <span className="rounded-full bg-blue-600 text-white text-sm font-bold px-5 py-2 shadow-sm">Smart Extract</span>
                </button>
              </div>
              </div>
            </div>
          )}

          {/* ══ UPLOADING ════════════════════════════════════════════════════════ */}
          {step === 'uploading' && (
            <div className="min-h-full flex flex-col items-center justify-center gap-8 px-8 py-10">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <FileText size={42} className="text-blue-400" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">Analyzing document…</p>
                <p className="text-sm text-gray-500 mt-1">{fileName}</p>
                <p className="text-xs text-blue-600 mt-1.5">Secure parsing in progress. This can take a few seconds for larger PDFs.</p>
              </div>
              <div className="flex gap-2.5 flex-wrap justify-center">
                {['Extracting milestones', 'Mapping resources', 'Identifying skills'].map((label, i) => (
                  <div key={i}
                    className="flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 text-xs px-3.5 py-1.5 font-semibold animate-pulse"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 1 — Extraction Review ════════════════════════════════════ */}
          {step === 's1' && (
            <div className="min-h-full p-6 space-y-5">
              {extractError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Extraction fallback activated</p>
                    <p className="text-xs text-amber-700/90 mt-0.5">{extractError}</p>
                  </div>
                </div>
              )}

              {isIncompatibleDocument(extractWarnings) && (
                <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                  <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-orange-700">Document not recognized as a project proposal</p>
                    <p className="text-xs text-orange-600 mt-0.5">{getIncompatibleMessage(extractWarnings)}</p>
                  </div>
                </div>
              )}

              {!isIncompatibleDocument(extractWarnings) && (extractWarnings.length > 0 || analysisMeta) && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 space-y-1.5">
                  {analysisMeta && (
                    <p className="text-xs text-blue-700 font-semibold">
                      Parsed in {Math.max(1, Math.round(analysisMeta.processingMs / 1000))}s
                      {analysisMeta.pages > 0 ? ` · ${analysisMeta.pages} page${analysisMeta.pages > 1 ? 's' : ''}` : ''}
                    </p>
                  )}
                  {extractWarnings.filter(w => !w.startsWith('INCOMPATIBLE_DOCUMENT:')).map((warning, idx) => (
                    <p key={`${warning}-${idx}`} className="text-xs text-blue-700">• {warning}</p>
                  ))}
                </div>
              )}

              {isIncompatibleDocument(extractWarnings) && analysisMeta && (
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2">
                  <p className="text-xs text-gray-500">
                    Parsed in {Math.max(1, Math.round(analysisMeta.processingMs / 1000))}s
                    {analysisMeta.pages > 0 ? ` · ${analysisMeta.pages} page${analysisMeta.pages > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
              )}

              {/* Project meta */}
              <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-3">
                <Zap size={15} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">Project Name</p>
                    <input className="text-sm font-bold text-gray-900 bg-transparent outline-none w-full placeholder:text-gray-400"
                      value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Enter project name…" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">Client</p>
                    <input className="text-sm font-bold text-gray-900 bg-transparent outline-none w-full placeholder:text-gray-400"
                      value={client} onChange={e => setClient(e.target.value)} placeholder="Client name…" />
                  </div>
                </div>
              </div>

              {/* ── Section 1: Milestone Timeline ── */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-blue-500" />
                    <span className="text-sm font-bold text-gray-900">Milestone Timeline</span>
                    <span className="hidden md:inline text-xs text-gray-600">· Editing End Date cascades all subsequent milestones</span>
                  </div>
                  <button onClick={addMilestone}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 transition-colors">
                    <Plus size={12} /> Add Milestone
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-8">#</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase">Milestone Name</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-36">Start Date</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-36">End Date</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-24">Duration</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((m, i) => {
                        const isEditing = editingMilestoneId === m.id
                        return (
                          <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/60 group ${isEditing ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input className="w-full text-base font-medium text-gray-900 bg-white border border-blue-200 focus:border-blue-400 rounded-md px-2 py-1 outline-none transition-colors"
                                  value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)} autoFocus />
                              ) : (
                                <span className="text-base font-semibold text-gray-900 px-2">{m.name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input type="date" className="text-sm text-gray-700 bg-white border border-blue-200 focus:border-blue-400 rounded-md px-2 py-1 outline-none transition-colors"
                                  value={m.startDate} onChange={e => updateMilestone(i, 'startDate', e.target.value)} />
                              ) : (
                                <span className="text-sm text-gray-700 px-2 font-medium">{fmtDate(m.startDate)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input type="date" className="text-sm text-gray-700 bg-white border border-blue-200 focus:border-blue-400 rounded-md px-2 py-1 outline-none transition-colors"
                                  value={m.endDate} onChange={e => updateMilestone(i, 'endDate', e.target.value)} />
                              ) : (
                                <span className="text-sm text-gray-700 px-2 font-medium">{fmtDate(m.endDate)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-gray-700">
                                {daysBetween(m.startDate, m.endDate) === 0 ? '1 day' : `+${daysBetween(m.startDate, m.endDate)} days`}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditingMilestoneId(isEditing ? null : m.id)}
                                  className={`p-1.5 rounded-lg transition-all ${isEditing
                                      ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                      : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600'
                                    }`}
                                  title={isEditing ? 'Save' : 'Edit'}
                                >
                                  {isEditing ? <Check size={14} /> : <Pencil size={12} />}
                                </button>
                                <button onClick={() => delMilestone(m.id)}
                                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {milestones.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center">
                            <p className="text-sm text-gray-400 font-medium">No milestones extracted from this document.</p>
                            <p className="text-xs text-gray-400 mt-1">Click <span className="font-semibold text-blue-600">+ Add Milestone</span> to add them manually.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {milestones.length > 1 && (
                  <div className="px-5 py-1.5 bg-amber-50/40 border-t border-amber-100">
                    <p className="text-xs text-amber-700 font-semibold">⚠️ Editing any milestone's End Date will auto-cascade all subsequent milestones forward</p>
                  </div>
                )}
              </div>

              {/* ── Section 2: Resources ── */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-emerald-500" />
                    <span className="text-sm font-bold text-gray-900">Required Resources & Skills</span>
                  </div>
                  <button onClick={addResource}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 transition-colors">
                    <Plus size={12} /> Add Resource
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-10">#</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-44">Role</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase">Skills Required</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase">Responsibilities</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-600 uppercase w-44">Bandwidth</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((r, i) => {
                        const isEditing = editingResourceId === r.id
                        return (
                          <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50/60 group ${isEditing ? 'bg-emerald-50/20' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">R{i + 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input className="w-full text-base font-semibold text-gray-900 bg-white border border-emerald-200 rounded-md px-2 py-1 outline-none transition-colors"
                                  value={r.role} onChange={e => updateResource(i, 'role', e.target.value)} placeholder="Role title…" autoFocus />
                              ) : (
                                <span className="text-base font-semibold text-gray-900 px-2">{r.role || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 items-center px-1">
                                {r.skills.map(s => (
                                  <span key={s} className="flex items-center gap-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 group/chip">
                                    {s}
                                    {isEditing && (
                                      <button onClick={() => removeSkill(i, s)}
                                        className="ml-0.5 opacity-0 group-hover/chip:opacity-100 text-blue-400 hover:text-red-500 transition-all">
                                        <X size={8} />
                                      </button>
                                    )}
                                  </span>
                                ))}
                                {isEditing ? (
                                  <input
                                    className="text-xs bg-white border border-dashed border-gray-200 rounded-full px-2 py-0.5 outline-none w-16 text-gray-500 focus:border-blue-300 focus:w-24 transition-all"
                                    placeholder="+ skill"
                                    onKeyDown={e => {
                                      const val = (e.target as HTMLInputElement).value.trim()
                                      if ((e.key === 'Enter' || e.key === ',') && val) {
                                        addSkill(i, val)
                                          ; (e.target as HTMLInputElement).value = ''
                                        e.preventDefault()
                                      }
                                    }}
                                  />
                                ) : r.skills.length === 0 && (
                                  <span className="text-xs text-gray-500 italic">No skills added</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none transition-colors"
                                  value={r.responsibilities} onChange={e => updateResource(i, 'responsibilities', e.target.value)} placeholder="Key responsibilities…" />
                              ) : (
                                <span className="text-sm text-gray-700 px-2 truncate block max-w-[260px] font-medium">{r.responsibilities || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px] overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${r.bandwidth >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                        r.bandwidth >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                      }`}
                                    style={{ width: `${r.bandwidth}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1 shadow-sm">
                                  {isEditing ? (
                                    <input type="number" min={0} max={100} step={5}
                                      className="w-9 text-xs font-bold text-gray-900 bg-transparent text-right outline-none appearance-none"
                                      value={r.bandwidth} onChange={e => updateResource(i, 'bandwidth', Math.min(100, Math.max(0, Number(e.target.value))))} />
                                  ) : (
                                    <span className="w-9 text-xs font-bold text-gray-900 text-right">{r.bandwidth}</span>
                                  )}
                                  <span className="text-xs text-gray-500 font-bold">%</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditingResourceId(isEditing ? null : r.id)}
                                  className={`p-1.5 rounded-lg transition-all ${isEditing
                                      ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                      : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                                    }`}
                                  title={isEditing ? 'Save' : 'Edit'}
                                >
                                  {isEditing ? <Check size={14} /> : <Pencil size={12} />}
                                </button>
                                <button onClick={() => delResource(r.id)}
                                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {resources.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center">
                            <p className="text-sm text-gray-400 font-medium">No roles extracted from this document.</p>
                            <p className="text-xs text-gray-400 mt-1">Click <span className="font-semibold text-emerald-600">+ Add Resource</span> to add roles manually.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 2 — Resource Allocation Search ════════════════════════════ */}
          {step === 's2' && (
            <div className="flex min-h-full">
              {/* Left Panel */}
              <div className="w-60 border-r border-gray-100 flex-shrink-0 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Required Resources</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">Select a slot to search internal team</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                  {resources.map((res, i) => (
                    <button key={res.id}
                      onClick={() => { setSelectedResIdx(i); setSkillSearch(''); setActiveSkillChip('') }}
                      className={`w-full text-left rounded-xl px-3 py-3.5 transition-all border ${selectedResIdx === i
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'border-gray-100 hover:bg-gray-50 text-gray-700 hover:border-gray-200'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${selectedResIdx === i ? 'text-blue-200' : 'text-gray-500'}`}>R{i + 1}</span>
                        <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${selectedResIdx === i ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{res.bandwidth}%</span>
                      </div>
                      <p className="text-sm font-bold leading-tight">{res.role || 'Unnamed Role'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Panel */}
              <div className="flex-1 flex flex-col min-w-0">
                {selectedRes ? (
                  <>
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-gray-900">
                          Results for: <span className="text-blue-600">{selectedRes.role || 'Unnamed Role'}</span>
                          <span className="text-sm text-gray-600 font-medium ml-2">· filter by skill tag or search below</span>
                        </p>
                        {selectedRes.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                            <span className="text-sm text-gray-700 self-center font-semibold">Skill filter:</span>
                            {selectedRes.skills.map(s => (
                              <button key={s}
                                onClick={() => { setSkillSearch(''); setActiveSkillChip(activeSkillChip === s ? '' : s) }}
                                className={`text-xs font-bold rounded-full px-2.5 py-1 transition-all cursor-pointer ${activeSkillChip === s ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  }`}
                              >{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative flex-shrink-0">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-300 w-44 bg-white"
                          placeholder="Search skills, name…"
                          value={skillSearch}
                          onChange={e => { setSkillSearch(e.target.value); setActiveSkillChip('') }}
                        />
                      </div>
                    </div>
                    <div className="px-5 py-2 bg-blue-50/50 border-b border-blue-100 text-sm text-blue-700 font-semibold">
                      Showing {filteredEmps.length} team member{filteredEmps.length !== 1 ? 's' : ''} · Bandwidth shows estimated availability after current project allocations
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {filteredEmps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-44 text-gray-400">
                          <Search size={26} className="mb-2 opacity-30" />
                          <p className="text-sm font-medium">No matching team members</p>
                          <p className="text-xs mt-1 opacity-60">Try a different skill or clear the filter</p>
                        </div>
                      ) : (
                        filteredEmps.map((emp: any) => {
                          const { score, matched, partial } = scoreEmployee(emp, selectedRes.skills)
                          return (
                            <EmpCard key={emp.ID} emp={emp} score={score} matched={matched} partial={partial} avail={estAvailBW(emp, {})} />
                          )
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Users size={28} className="mb-2 opacity-30" />
                    <p className="text-sm">Select a resource slot from the left panel</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ STEP 3 — Auto Allocation + TBD External + Summary ══════════════ */}
          {step === 's3' && (
            <div className="min-h-full p-6 space-y-6">

              {/* Banner */}
              <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-3.5">
                <Zap size={16} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">Auto Allocation Complete</p>
                  <p className="text-xs text-gray-600 mt-0.5">Best internal fit assigned per role · TBD shown where no match found · Assign external partners below for any TBD slots</p>
                </div>
                <div className="flex gap-3">
                  {[
                    { label: 'Matched', value: allocations.filter(a => a.status === 'matched').length, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Partial', value: allocations.filter(a => a.status === 'partial').length, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { label: 'TBD', value: allocations.filter(a => a.tbdBW > 0).length, cls: 'text-gray-500 bg-gray-50 border-gray-200' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-lg border px-3 py-1.5 text-center ${s.cls}`}>
                      <p className="text-base font-bold leading-none">{s.value}</p>
                      <p className="text-xs font-bold uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3A: Allocation Table (Classic View) ── */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <Users size={14} className="text-gray-500" />
                  <span className="text-sm font-bold text-gray-900">Allocation Results</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase w-10">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Role</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase w-28">Required BW</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Suggested Resource</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase w-28">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase w-20">Status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-600 uppercase w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((alloc, i) => {
                      const resRow = resources.find(r => r.id === alloc.resourceId)
                      return (
                        <tr key={alloc.resourceId} className={`border-b border-gray-50 ${alloc.tbdBW > 0 ? 'bg-amber-50/30' : 'hover:bg-gray-50/40'}`}>
                          <td className="px-4 py-3">
                            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">R{i + 1}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{alloc.role}</p>
                            {resRow?.skills.length ? (
                              <p className="text-xs text-gray-600 mt-0.5">{resRow.skills.slice(0, 4).join(' · ')}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${alloc.requiredBW}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-700">{alloc.requiredBW}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1.5">
                              {alloc.assignments.map(as => (
                                <div key={as.id} className="flex items-center justify-between gap-3 p-1.5 rounded-lg border border-gray-100 bg-white shadow-sm group/item">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg ${as.type === 'internal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'} text-xs font-bold flex items-center justify-center flex-shrink-0 border`}>
                                      {as.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 truncate">{as.name}</p>
                                      <p className="text-xs text-gray-600 truncate">
                                        <span className="font-semibold">{as.bw}% BW</span> · {as.score}% match {as.subText && `· ${as.subText}`}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeAssignment(alloc.resourceId, as.id) }}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover/item:opacity-100"
                                    title="Remove Assignment"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              {alloc.tbdBW > 0 && (
                                <div className="flex items-center gap-2 p-1.5 rounded-lg border border-dashed border-amber-200 bg-amber-50/20">
                                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-300 flex-shrink-0" />
                                  <span className="text-xs text-amber-700 font-bold">
                                    {alloc.tbdBW}% Open Slot — Assign Below
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {alloc.assignments.some(a => a.type === 'internal') && (
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 w-fit border border-emerald-100">Internal</span>
                              )}
                              {alloc.assignments.some(a => a.type === 'external') && (
                                <span className="text-xs font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5 w-fit border border-blue-100">External</span>
                              )}
                              {alloc.tbdBW > 0 && (
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit border border-amber-100">TBD</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {alloc.status === 'matched' && alloc.tbdBW === 0 && (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-100">✔ Matched</span>
                            )}
                            {alloc.status === 'partial' && alloc.tbdBW === 0 && (
                              <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg w-fit border border-blue-100">Partial</span>
                            )}
                            {alloc.tbdBW > 0 && (
                              <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg w-fit border border-amber-100">Open</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedAllocId(alloc.resourceId)
                                document.getElementById('allocation-refinement')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedAllocId === alloc.resourceId
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                              {selectedAllocId === alloc.resourceId ? 'Selected' : 'Edit Mapping'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── 3B/3C: Allocation Refinement & Resource Manager ── */}
              <div id="allocation-refinement" className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2.5 px-1">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Zap size={13} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Allocation Refinement Manager</p>
                    <p className="text-xs text-gray-600">Manually override any slot or assign consultants/partners to fill gaps</p>
                    {selectedAllocation && (
                      <p className="text-xs font-semibold text-blue-700 mt-0.5">
                        Mapped to: {selectedAllocation.role} ({getCoveragePct(selectedAllocation)}%)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm" style={{ minHeight: 560 }}>
                  {/* Left Panel: All Slots */}
                  <div className="w-64 border-r border-gray-100 bg-gray-50/40 flex-shrink-0 flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-100/30 font-bold text-xs text-gray-600 uppercase tracking-widest text-center">
                      Resource Slot Progress
                    </div>
                      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
                        {allocations.map((alloc, i) => {
                          const isActive = selectedAllocId === alloc.resourceId
                          const state = getAllocationState(alloc)
                          const coverage = getCoveragePct(alloc)
                          
                          let cardCls = 'bg-white border border-gray-100 text-gray-700 hover:border-gray-200'
                          let badgeCls = 'bg-gray-100 text-gray-500'
                          let statusLabel = 'Open'
                          let statusIcon: ReactNode = <HelpCircle size={12} className="text-rose-500" />
                          
                          if (isActive) {
                            cardCls = 'bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-600'
                            badgeCls = 'bg-white/20 text-white'
                          }

                          if (state === 'matched') {
                            if (!isActive) {
                              cardCls = 'bg-emerald-50/60 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60'
                            }
                            badgeCls = isActive ? badgeCls : 'bg-emerald-100 text-emerald-700'
                            statusLabel = 'Matched'
                            statusIcon = <CheckCircle2 size={12} className={isActive ? 'text-white' : 'text-emerald-600'} />
                          } else if (state === 'partial') {
                            if (!isActive) {
                              cardCls = 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/60'
                            }
                            badgeCls = isActive ? badgeCls : 'bg-amber-100 text-amber-700'
                            statusLabel = 'Partial'
                            statusIcon = <AlertTriangle size={12} className={isActive ? 'text-white' : 'text-amber-600'} />
                          } else {
                            if (!isActive) {
                              cardCls = 'bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-100/60'
                            }
                            badgeCls = isActive ? badgeCls : 'bg-rose-100 text-rose-700'
                            statusLabel = 'Open'
                            statusIcon = <HelpCircle size={12} className={isActive ? 'text-white' : 'text-rose-600'} />
                          }

                          return (
                            <button key={alloc.resourceId}
                              onClick={() => setSelectedAllocId(alloc.resourceId)}
                              className={`w-full text-left rounded-xl px-3 py-3 transition-all space-y-2 relative group overflow-hidden ${cardCls}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                                  Slot {i + 1}
                                </span>
                                <span className={`text-xs font-bold rounded-full px-2 py-0.5 border border-current/10 inline-flex items-center gap-1 ${badgeCls}`}>
                                  {statusIcon}
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="text-[13px] font-bold leading-tight truncate">{alloc.role}</p>
                              <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${state === 'matched' ? 'bg-emerald-500' : state === 'partial' ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${coverage}%` }}
                                />
                              </div>
                              <p className={`text-xs font-semibold ${isActive ? 'text-white/90' : 'text-gray-600'}`}>
                                {coverage}% mapped
                              </p>
                            </button>
                          )
                        })}
                      </div>
                  </div>

                  {/* Right Panel: Three-Tab Search Manager */}
                  <div className="flex-1 flex flex-col bg-white">
                    {(() => {
                      const sel = allocations.find(a => a.resourceId === selectedAllocId)
                      if (!sel) return (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                          <Users size={32} className="mb-2" />
                          <p className="text-sm font-medium">Select a slot to refine allocation</p>
                        </div>
                      )
                      const res = resources.find(r => r.id === selectedAllocId)!

                      // Scorers
                      const internalCands = (internalData as any).employees
                        .map((emp: any) => ({ emp, ...scoreEmployee(emp, res.skills), avail: estAvailBW(emp, {}) }))
                        .filter((c: any) => c.score >= 10 && c.avail > 0)
                        .sort((a: any, b: any) => b.score - a.score)

                      const extAll = (externalData as any).companies
                        .map((c: any) => ({ c, ...scoreExternal(c, res.skills) }))
                        .filter((x: any) => x.score >= 10)
                        .sort((a: any, b: any) => b.score - a.score)

                      const activeList = searchTab === 'Internal Team' ? internalCands : extAll.filter(x => (x.c.Type || 'External Partner') === searchTab)

                      return (
                        <>
                          <div className="px-5 py-0 border-b border-gray-100 bg-white">
                            <div className="flex items-center justify-between border-b border-gray-50 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900">
                                  Refining Slot: <span className="text-blue-600">{sel.role}</span>
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5 truncate max-w-md italic">
                                  {getTbdReason(sel, res)}
                                </p>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2">
                                <Search size={14} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-600 border border-gray-100 bg-gray-50 px-2 py-0.5 rounded-full">Manual Override</span>
                              </div>
                            </div>

                            {/* Triple Tabs */}
                            <div className="flex gap-6">
                              {[
                                { id: 'Internal Team', label: 'Internal Team', count: internalCands.length },
                                { id: 'External Consultant', label: 'Consultants', count: extAll.filter(x => x.c.Type === 'External Consultant').length },
                                { id: 'External Partner', label: 'Partners', count: extAll.filter(x => (x.c.Type || 'External Partner') === 'External Partner').length }
                              ].map(t => (
                                <button key={t.id} onClick={() => setSearchTab(t.id as any)}
                                  className={`relative py-3.5 text-sm font-bold transition-all ${searchTab === t.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                  <div className="flex items-center gap-2">
                                    {t.label}
                                    <span className={`text-sm rounded-full px-2 py-0.5 ${searchTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                                  </div>
                                  {searchTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-gray-50/20">
                            {activeList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-48 text-gray-400 opacity-60">
                                <Search size={32} className="mb-2" />
                                <p className="text-sm font-medium">No matches in {searchTab}</p>
                              </div>
                            ) : (
                              activeList.map((cand: any) => (
                                searchTab === 'Internal Team' ? (
                                  <EmpCard
                                    key={cand.emp.ID}
                                    emp={cand.emp}
                                    score={cand.score}
                                    matched={cand.matched}
                                    partial={cand.partial}
                                    avail={cand.avail}
                                    assignAction={
                                      <button
                                        onClick={() => assignInternalS3(selectedAllocId!, cand.emp)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                                      >
                                        Assign
                                      </button>
                                    }
                                  />
                                ) : (
                                  <ExternalCard
                                    key={cand.c['Company Name'] + (cand.c['Contact Person'] || '')}
                                    company={cand.c}
                                    score={cand.score}
                                    matched={cand.matched}
                                    partial={cand.partial}
                                    assigned={sel.assignments.some(as => as.id === (cand.c['Company Name'] + (cand.c['Contact Person'] || '')))}
                                    onAssign={() => assignExternal(selectedAllocId!, cand.c)}
                                  />
                                )
                              ))
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* ── 3D: Final Summary ── */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {projectName || 'New Project'}
                      {client && <span className="text-gray-600 font-normal ml-1.5">· {client}</span>}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {milestones.length} milestones
                      {milestones[0] ? ` · ${fmtDate(milestones[0].startDate)} → ${fmtDate(milestones[milestones.length - 1]?.endDate)}` : ''}
                      {' · '}{resources.length} resource slots
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{allocations.reduce((acc, a) => acc + a.assignments.filter(as => as.type === 'internal').length, 0)}</p>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Internal</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">{allocations.reduce((acc, a) => acc + a.assignments.filter(as => as.type === 'external').length, 0)}</p>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">External</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-500">{allocations.filter(a => a.tbdBW > 0).length}</p>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Open Slots</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── Footer ── */}
        {step !== 'choose' && step !== 'uploading' && (
          <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={() => {
                if (step === 's1') setStep('choose')
                else if (step === 's2') setStep('s1')
                else if (step === 's3') setStep('s2')
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={15} /> Back
            </button>

            <div className="flex items-center gap-3">
              {step === 's1' && (
                <button onClick={() => setStep('s2')}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-bold transition-colors shadow-sm">
                  Next: Resource Search <ChevronRight size={15} />
                </button>
              )}
              {step === 's2' && (
                <button onClick={proceedToStep3}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-bold transition-colors shadow-sm">
                  <Zap size={14} /> Run Auto Allocation
                </button>
              )}
              {step === 's3' && (
                <button onClick={handleSave}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-sm font-bold transition-colors shadow-sm">
                  <Check size={14} /> Save & Finalize Proposal
                </button>
              )}
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".html,.pdf,.docx,.doc" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          onClick={e => { (e.target as HTMLInputElement).value = '' }}
        />
      </div>
    </div>
  )
}
