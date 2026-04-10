import { useState, useMemo } from 'react'
import internalData from '../../data/internal_data.js'
import externalData from '../../data/external_data.js'

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function calcSkillMatch(employeeSkills: string, requiredSkills: string[]): number {
  if (!requiredSkills.length) return 0
  if (!employeeSkills) return 0
  const empList = employeeSkills.toLowerCase().split(/[,]+/).map(s => s.trim()).filter(Boolean)
  let matched = 0
  for (const req of requiredSkills) {
    const r = req.toLowerCase().trim()
    if (empList.some(s => s.includes(r) || r.includes(s))) matched++
  }
  return Math.round((matched / requiredSkills.length) * 100)
}

function calcExternalMatch(company: any, requiredSkills: string[]): number {
  if (!requiredSkills.length) return 0
  const combined = [
    company['Tech Stack'] || '',
    company['Domains'] || '',
    company['Strengths'] || '',
    company['Overview'] || '',
  ].join(' ').toLowerCase()
  let matched = 0
  for (const req of requiredSkills) {
    if (combined.includes(req.toLowerCase().trim())) matched++
  }
  return Math.round((matched / requiredSkills.length) * 100)
}

function estimateBandwidth(currentProjects: string): { available: number; occupied: number } {
  const count = currentProjects
    ? currentProjects.split(',').filter(p => p.trim()).length
    : 0
  const occupied = Math.min(80, count * 20)
  return { available: 100 - occupied, occupied }
}

function scoreBarColor(score: number) {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-400'
}

function scoreBadge(score: number) {
  if (score >= 75) return { label: 'Excellent Match', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (score >= 50) return { label: 'Good Match', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (score >= 25) return { label: 'Partial Match', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
  return { label: 'Low Match', cls: 'bg-red-50 text-red-600 border-red-200' }
}

// ─── Internal Employee Card ────────────────────────────────────────────────────

function InternalCard({
  employee,
  requiredSkills,
  isEditing,
  onEdit,
  onSave,
}: {
  employee: any
  requiredSkills: string[]
  isEditing: boolean
  onEdit: () => void
  onSave: (u: any) => void
}) {
  const [form, setForm] = useState({ ...employee })
  const bw = estimateBandwidth(employee['Current Projects'] || '')
  const skills = (employee['Skills'] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const badge = employee.score > 0 ? scoreBadge(employee.score) : null

  const handleSave = () => onSave({ ...form })

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-blue-400 bg-blue-50/30 p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900">Editing: {employee['Name']}</h4>
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors">Save</button>
            <button onClick={onEdit} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
            <input value={form['Name']} onChange={e => setForm({ ...form, Name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <input value={form['Role']} onChange={e => setForm({ ...form, Role: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Resource Type</label>
            <select value={form['Type']} onChange={e => setForm({ ...form, Type: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white">
              {['Delivery', 'POC', 'Both', ''].map(o => <option key={o} value={o}>{o || 'Not Set'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Current Projects</label>
            <input value={form['Current Projects']} onChange={e => setForm({ ...form, 'Current Projects': e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Skills (comma-separated)</label>
            <textarea value={form['Skills']} onChange={e => setForm({ ...form, Skills: e.target.value })} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Other Contributions</label>
            <textarea value={form['Other Contributions']} onChange={e => setForm({ ...form, 'Other Contributions': e.target.value })} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white shadow-sm flex-shrink-0">
            {(employee['Name'] || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">{employee['Name']}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{employee['Role']}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {employee['Type'] && (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              employee['Type'] === 'Delivery' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              employee['Type'] === 'POC' ? 'bg-purple-50 text-purple-700 border-purple-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {employee['Type']}
            </span>
          )}
          <span className="rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            🟢 Internal
          </span>
          <button onClick={onEdit} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors">
            Edit
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Skill Match Score */}
        {requiredSkills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">⭐ Skill Match Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{employee.score} / 100</span>
                {badge && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(employee.score)}`}
                style={{ width: `${employee.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Bandwidth */}
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">── Bandwidth</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500">Available</span>
                <span className="font-bold text-emerald-700">{bw.available}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${bw.available}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500">Occupied</span>
                <span className="font-bold text-amber-700">{bw.occupied}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${bw.occupied}%` }} />
              </div>
            </div>
          </div>
          {employee['Current Projects'] && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Active: {employee['Current Projects'].split(',').slice(0, 2).join(', ')}{employee['Current Projects'].split(',').length > 2 ? ` +${employee['Current Projects'].split(',').length - 2} more` : ''}
            </p>
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">── Full Skill Set</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 8).map((skill: string) => {
                const matched = requiredSkills.some(r =>
                  skill.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(skill.toLowerCase())
                )
                return (
                  <span
                    key={skill}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      requiredSkills.length > 0 && matched
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {requiredSkills.length > 0 && matched ? '✅ ' : ''}{skill}
                  </span>
                )
              })}
              {skills.length > 8 && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400">
                  +{skills.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Past Projects */}
        {employee['Past Projects'] && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1">── Past Projects</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">{employee['Past Projects']}</p>
          </div>
        )}

        {/* Assign button */}
        <div className="pt-2 border-t border-gray-100">
          <button className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm">
            Assign to Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── External Company Card ─────────────────────────────────────────────────────

function ExternalCard({
  company,
  requiredSkills,
  isEditing,
  onEdit,
  onSave,
}: {
  company: any
  requiredSkills: string[]
  isEditing: boolean
  onEdit: () => void
  onSave: (u: any) => void
}) {
  const [form, setForm] = useState({ ...company })
  const techSkills = (company['Tech Stack'] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const badge = company.score > 0 ? scoreBadge(company.score) : null

  const handleSave = () => onSave({ ...form })

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50/30 p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900">Editing: {company['Company Name']}</h4>
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors">Save</button>
            <button onClick={onEdit} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
            <input value={form['Company Name']} onChange={e => setForm({ ...form, 'Company Name': e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label>
            <input value={form['Contact Person']} onChange={e => setForm({ ...form, 'Contact Person': e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input value={form['Email']} onChange={e => setForm({ ...form, Email: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Team Size</label>
            <input value={form['Team Size']} onChange={e => setForm({ ...form, 'Team Size': e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Domains</label>
            <input value={form['Domains']} onChange={e => setForm({ ...form, Domains: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Engagement Model</label>
            <input value={form['Engagement Model']} onChange={e => setForm({ ...form, 'Engagement Model': e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tech Stack (comma-separated)</label>
            <textarea value={form['Tech Stack']} onChange={e => setForm({ ...form, 'Tech Stack': e.target.value })} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Overview</label>
            <textarea value={form['Overview']} onChange={e => setForm({ ...form, Overview: e.target.value })} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Differentiator</label>
            <textarea value={form['Differentiator']} onChange={e => setForm({ ...form, Differentiator: e.target.value })} rows={1}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-amber-300 transition-all overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white shadow-sm flex-shrink-0">
            {(company['Company Name'] || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">{company['Company Name']}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{company['Contact Person']} · {company['Email']}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border bg-amber-50 text-amber-700 border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            🔵 External
          </span>
          <button onClick={onEdit} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors">
            Edit
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Skill / Tech Match Score */}
        {requiredSkills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">⭐ Tech Match Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{company.score} / 100</span>
                {badge && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(company.score)}`}
                style={{ width: `${company.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Company Info */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <p className="text-[10px] text-gray-500 mb-0.5">Team Size</p>
            <p className="text-xs font-bold text-gray-900">{company['Team Size'] || '—'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <p className="text-[10px] text-gray-500 mb-0.5">Engagement</p>
            <p className="text-xs font-bold text-gray-900">{company['Engagement Model']?.split(',')[0] || '—'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <p className="text-[10px] text-gray-500 mb-0.5">Availability</p>
            <p className="text-xs font-bold text-emerald-700">100%</p>
          </div>
        </div>

        {/* Overview */}
        {company['Overview'] && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1">── Overview</p>
            <p className="text-[11px] text-gray-600 leading-relaxed">{company['Overview']}</p>
          </div>
        )}

        {/* Tech Stack */}
        {techSkills.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">── Tech Stack</p>
            <div className="flex flex-wrap gap-1.5">
              {techSkills.slice(0, 8).map((skill: string) => {
                const matched = requiredSkills.some(r =>
                  skill.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(skill.toLowerCase())
                )
                return (
                  <span
                    key={skill}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      requiredSkills.length > 0 && matched
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {requiredSkills.length > 0 && matched ? '✅ ' : ''}{skill}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Domains */}
        {company['Domains'] && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1.5">── Domains</p>
            <div className="flex flex-wrap gap-1.5">
              {company['Domains'].split(',').map((d: string) => (
                <span key={d} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  {d.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Differentiator */}
        {company['Differentiator'] && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1">── Differentiator</p>
            <p className="text-[11px] text-gray-600 italic">{company['Differentiator']}</p>
          </div>
        )}

        {/* Certifications */}
        {company['Certifications'] && company['Certifications'] !== 'NA' && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-1">── Certifications</p>
            <p className="text-[11px] text-gray-600">{company['Certifications']}</p>
          </div>
        )}

        {/* Assign button */}
        <div className="pt-2 border-t border-gray-100">
          <button className="w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm">
            Engage as Partner
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Resource Tab ─────────────────────────────────────────────────────────

interface ResourceTabProps {
  project?: any
}

export default function ResourceTab({ project }: ResourceTabProps) {
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal')
  const [editingInternalId, setEditingInternalId] = useState<number | null>(null)
  const [editingExternalIdx, setEditingExternalIdx] = useState<number | null>(null)
  const [internalEmployees, setInternalEmployees] = useState<any[]>(internalData.employees)
  const [externalCompanies, setExternalCompanies] = useState<any[]>(externalData.companies)

  const addSkill = () => {
    const t = newSkill.trim()
    if (t && !requiredSkills.map(s => s.toLowerCase()).includes(t.toLowerCase())) {
      setRequiredSkills([...requiredSkills, t])
    }
    setNewSkill('')
  }

  const removeSkill = (s: string) => setRequiredSkills(requiredSkills.filter(x => x !== s))

  const scoredInternal = useMemo(
    () =>
      internalEmployees
        .map(emp => ({ ...emp, score: calcSkillMatch(emp['Skills'] || '', requiredSkills) }))
        .sort((a, b) => b.score - a.score),
    [internalEmployees, requiredSkills]
  )

  const scoredExternal = useMemo(
    () =>
      externalCompanies
        .map(company => ({ ...company, score: calcExternalMatch(company, requiredSkills) }))
        .sort((a, b) => b.score - a.score),
    [externalCompanies, requiredSkills]
  )

  const highInternal = scoredInternal.filter(e => e.score >= 75).length
  const highExternal = scoredExternal.filter(e => e.score >= 75).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* ── Left Panel ──────────────────────────────────────────── */}
      <div className="lg:col-span-1 space-y-4">
        {/* Required Skills Panel */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="text-sm font-bold text-gray-900">Required Skills</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Type skill → Enter or click +</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill()}
                placeholder="e.g. Python, React..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                onClick={addSkill}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                +
              </button>
            </div>
            <div className="min-h-[40px] flex flex-wrap gap-1.5">
              {requiredSkills.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">Add skills to see match scores</p>
              ) : (
                requiredSkills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {s}
                    <button onClick={() => removeSkill(s)} className="ml-0.5 text-blue-400 hover:text-blue-700 leading-none">×</button>
                  </span>
                ))
              )}
            </div>
            {requiredSkills.length > 0 && (
              <button onClick={() => setRequiredSkills([])} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Resource Pool Stats */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <h3 className="text-sm font-bold text-gray-900">Resource Pool</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Internal Staff</span>
              <span className="text-sm font-bold text-emerald-600">{internalEmployees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">External Partners</span>
              <span className="text-sm font-bold text-amber-600">{externalCompanies.length}</span>
            </div>
            {requiredSkills.length > 0 && (
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Match Summary</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600">🟢 Internal top matches</span>
                  <span className="text-xs font-bold text-emerald-600">{highInternal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600">🔵 External top matches</span>
                  <span className="text-xs font-bold text-amber-600">{highExternal}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wide">Score Legend</p>
          <div className="space-y-1.5">
            {[
              { label: 'Excellent Match (≥75)', color: 'bg-emerald-500' },
              { label: 'Good Match (50–74)', color: 'bg-amber-500' },
              { label: 'Partial Match (25–49)', color: 'bg-orange-400' },
              { label: 'Low Match (<25)', color: 'bg-red-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                <span className="text-[10px] text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────── */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Tab switcher */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setActiveTab('internal')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'internal'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🟢 Internal Staff ({scoredInternal.length})
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'external'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔵 External Partners ({scoredExternal.length})
          </button>
        </div>

        {/* Sort hint */}
        {requiredSkills.length > 0 && (
          <p className="text-[11px] text-gray-500 -mt-2">
            ↕ Sorted by skill match score · highest first
          </p>
        )}

        {/* Cards */}
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
          {activeTab === 'internal' && scoredInternal.map(emp => (
            <InternalCard
              key={emp['ID']}
              employee={emp}
              requiredSkills={requiredSkills}
              isEditing={editingInternalId === emp['ID']}
              onEdit={() => setEditingInternalId(editingInternalId === emp['ID'] ? null : emp['ID'])}
              onSave={updated => {
                setInternalEmployees(prev => prev.map(e => e['ID'] === updated['ID'] ? updated : e))
                setEditingInternalId(null)
              }}
            />
          ))}

          {activeTab === 'external' && scoredExternal.map((company, idx) => (
            <ExternalCard
              key={company['Company Name']}
              company={company}
              requiredSkills={requiredSkills}
              isEditing={editingExternalIdx === idx}
              onEdit={() => setEditingExternalIdx(editingExternalIdx === idx ? null : idx)}
              onSave={updated => {
                setExternalCompanies(prev => prev.map((c, i) => i === idx ? updated : c))
                setEditingExternalIdx(null)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
