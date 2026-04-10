import { useState } from 'react'

interface SummaryTabProps {
  project: any
  onUpdate?: (updated: any) => void
}

function EditableField({ label, value, editing, onChange, multiline = false }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  multiline?: boolean
}) {
  if (editing) {
    if (multiline) {
      return (
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
          />
        </div>
      )
    }
    return (
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">
        {value || <span className="text-gray-400 font-normal italic">Not specified</span>}
      </p>
    </div>
  )
}

export default function SummaryTab({ project, onUpdate }: SummaryTabProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...project })

  const milestones = project['Milestones'] || []
  const completedMs = milestones.filter((m: any) => m['Current Status'] === 'Completed').length
  const atRiskMs = milestones.filter((m: any) =>
    m['Current Status'] === 'Delayed' || m['Current Status'] === 'On Hold'
  ).length
  const totalMs = milestones.length

  const handleSave = () => {
    onUpdate?.(form)
    setEditing(false)
  }

  const handleCancel = () => {
    setForm({ ...project })
    setEditing(false)
  }

  const aiSummary = `This project for ${form['Client'] || 'internal stakeholders'} delivers ${form['Project Type'] || 'a key initiative'}. Managed by ${form['Delivery Manager'] || 'the delivery team'} with ${totalMs} milestone${totalMs !== 1 ? 's' : ''}, ${completedMs} completed and ${atRiskMs} at risk. Revenue model: ${form['Revenue Model'] || 'TBD'}. Resources: ${form['Resource Aligned'] || 'to be assigned'}.`

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Milestones', value: totalMs, color: 'text-blue-600', bg: 'from-blue-50 to-blue-100/40', border: 'border-blue-200' },
          { label: 'Completed', value: completedMs, color: 'text-emerald-600', bg: 'from-emerald-50 to-emerald-100/40', border: 'border-emerald-200' },
          { label: 'At Risk', value: atRiskMs, color: 'text-amber-600', bg: 'from-amber-50 to-amber-100/40', border: 'border-amber-200' },
          { label: 'Pending', value: totalMs - completedMs - atRiskMs, color: 'text-gray-600', bg: 'from-gray-50 to-gray-100/40', border: 'border-gray-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border ${stat.border} bg-gradient-to-br ${stat.bg} p-4 text-center`}>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-600 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Project Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div>
            <h3 className="text-base font-bold text-gray-900">Project Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Core information about the project</p>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm">
                Save Changes
              </button>
              <button onClick={handleCancel} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
              Edit Details
            </button>
          )}
        </div>
        <div className="p-6 grid grid-cols-3 gap-6">
          <EditableField label="Project Name" value={form['Project Name'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Project Name': v })} />
          <EditableField label="Client" value={form['Client'] || ''} editing={editing} onChange={v => setForm({ ...form, Client: v })} />
          <EditableField label="Project Type" value={form['Project Type'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Project Type': v })} />
          <EditableField label="Service Type" value={form['Service Type'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Service Type': v })} />
          <EditableField label="Revenue Model" value={form['Revenue Model'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Revenue Model': v })} />
          <EditableField label="Handled By" value={form['Handled By'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Handled By': v })} />
        </div>
      </div>

      {/* Stakeholders Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-purple-50/30">
          <h3 className="text-base font-bold text-gray-900">Stakeholders</h3>
          <p className="text-xs text-gray-500 mt-0.5">Key contacts and responsibilities</p>
        </div>
        <div className="p-6 grid grid-cols-2 gap-6">
          <EditableField label="Delivery Manager" value={form['Delivery Manager'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Delivery Manager': v })} />
          <EditableField label="Client SPOC" value={form['Client SPOC'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Client SPOC': v })} />
          <EditableField label="Resource Aligned" value={form['Resource Aligned'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Resource Aligned': v })} />
          <EditableField label="Additional Info" value={form['Add Info'] || ''} editing={editing} onChange={v => setForm({ ...form, 'Add Info': v })} />
        </div>
      </div>

      {/* Scope Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-green-50/30">
          <h3 className="text-base font-bold text-gray-900">Project Scope</h3>
          <p className="text-xs text-gray-500 mt-0.5">What this project covers</p>
        </div>
        <div className="p-6">
          <EditableField
            label="Scope Description"
            value={form['Scope'] || 'Development and delivery of the project as per the agreed Statement of Work (SOW), including all deliverables, milestones, and quality standards.'}
            editing={editing}
            onChange={v => setForm({ ...form, Scope: v })}
            multiline
          />
        </div>
      </div>

      {/* AI Summary Card */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-100">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="text-lg">📝</span> AI-Generated Summary
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Auto-generated from project data</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
          <div className="flex gap-3">
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm">
              Regenerate Summary
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Edit Fields
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
