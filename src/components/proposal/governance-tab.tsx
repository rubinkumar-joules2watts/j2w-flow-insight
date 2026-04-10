import { useState } from 'react'

interface GovernanceTabProps {
  project: any
}

const taskStatusColor = (s: string) =>
  s === 'Done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
  s === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
  'bg-gray-50 text-gray-600 border-gray-200'

const taskStatusIcon = (s: string) =>
  s === 'Done' ? '✅' : s === 'In Progress' ? '🔄' : '⏳'

const reviewStatusColor = (s: string) =>
  s === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
  s === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
  'bg-red-50 text-red-600 border-red-200'

interface Task { ID: string; Name: string; AssignedTo: string; Status: string; DueDate: string; Completion: number }
interface Review { ID: string; Type: string; Reviewer: string; Date: string; Status: string; Notes: string }
interface Metric { label: string; target: string; current: number; unit: string; status: string }

export default function GovernanceTab({ project }: GovernanceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'reviews' | 'progress'>('tasks')

  const milestones = project['Milestones'] || []
  const overallCompletion = milestones.length > 0
    ? Math.round(milestones.reduce((s: number, m: any) => s + (m['% Complete'] || 0), 0) / milestones.length)
    : 0

  // Metrics
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'Task Completion Rate', target: '> 90%', current: 88, unit: '%', status: 'below' },
    { label: 'Client Satisfaction Rate', target: '4.9+', current: 98, unit: '%', status: 'on_track' },
    { label: 'Team Productivity', target: 'High', current: 78, unit: '%', status: 'moderate' },
  ])
  const [editingMetrics, setEditingMetrics] = useState(false)
  const [reportingFreq, setReportingFreq] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly')

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([
    { ID: 'T001', Name: 'Requirement Gathering', AssignedTo: 'Project Manager', Status: 'Done', DueDate: 'Apr 05', Completion: 100 },
    { ID: 'T002', Name: 'Architecture Design', AssignedTo: 'Tech Lead', Status: 'In Progress', DueDate: 'Apr 12', Completion: 60 },
    { ID: 'T003', Name: 'Backend Development', AssignedTo: 'Dev Team', Status: 'Pending', DueDate: 'Apr 25', Completion: 0 },
    { ID: 'T004', Name: 'QA & Testing', AssignedTo: 'QA Team', Status: 'Pending', DueDate: 'Apr 28', Completion: 0 },
  ])
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskDraft, setTaskDraft] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState<Partial<Task>>({})
  const [addingTask, setAddingTask] = useState(false)

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([
    { ID: 'R001', Type: 'Design Review', Reviewer: 'Client POC', Date: 'Apr 10', Status: 'Approved', Notes: 'Looks good' },
    { ID: 'R002', Type: 'Code Review', Reviewer: 'Sr. Developer', Date: 'Apr 18', Status: 'Pending', Notes: '—' },
  ])
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [reviewDraft, setReviewDraft] = useState<Review | null>(null)
  const [newReview, setNewReview] = useState<Partial<Review>>({})
  const [addingReview, setAddingReview] = useState(false)

  // Task handlers
  const startEditTask = (t: Task) => { setEditingTaskId(t.ID); setTaskDraft({ ...t }) }
  const saveTask = () => { if (taskDraft) { setTasks(prev => prev.map(t => t.ID === taskDraft.ID ? taskDraft : t)); setEditingTaskId(null); setTaskDraft(null) } }
  const cancelTask = () => { setEditingTaskId(null); setTaskDraft(null) }
  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.ID !== id))
  const addTask = () => {
    const id = `T${String(tasks.length + 1).padStart(3, '0')}`
    setTasks(prev => [...prev, { ID: id, Name: newTask.Name || '', AssignedTo: newTask.AssignedTo || '', Status: newTask.Status || 'Pending', DueDate: newTask.DueDate || '', Completion: Number(newTask.Completion) || 0 }])
    setNewTask({}); setAddingTask(false)
  }

  // Review handlers
  const startEditReview = (r: Review) => { setEditingReviewId(r.ID); setReviewDraft({ ...r }) }
  const saveReview = () => { if (reviewDraft) { setReviews(prev => prev.map(r => r.ID === reviewDraft.ID ? reviewDraft : r)); setEditingReviewId(null); setReviewDraft(null) } }
  const cancelReview = () => { setEditingReviewId(null); setReviewDraft(null) }
  const deleteReview = (id: string) => setReviews(prev => prev.filter(r => r.ID !== id))
  const addReview = () => {
    const id = `R${String(reviews.length + 1).padStart(3, '0')}`
    setReviews(prev => [...prev, { ID: id, Type: newReview.Type || '', Reviewer: newReview.Reviewer || '', Date: newReview.Date || '', Status: newReview.Status || 'Pending', Notes: newReview.Notes || '—' }])
    setNewReview({}); setAddingReview(false)
  }

  const inputCls = "w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
  const smSelectCls = "rounded border border-gray-200 px-2 py-1 text-xs bg-white focus:outline-none"

  return (
    <div className="space-y-5">
      {/* ── Governance Metrics ───────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div>
            <h3 className="text-base font-bold text-gray-900">📊 Governance Metrics</h3>
            <p className="text-xs text-gray-500 mt-0.5">Project health and performance indicators</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
              {(['Daily', 'Weekly', 'Monthly'] as const).map(f => (
                <button key={f} onClick={() => setReportingFreq(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${reportingFreq === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setEditingMetrics(!editingMetrics)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors">
              {editingMetrics ? 'Done' : 'Edit Targets'}
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {metrics.map((m, i) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{m.label}</span>
                  {editingMetrics ? (
                    <input value={m.target}
                      onChange={e => setMetrics(prev => prev.map((x, j) => j === i ? { ...x, target: e.target.value } : x))}
                      className="inline rounded-lg border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                  ) : (
                    <span className="text-xs text-gray-500">Target: {m.target}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingMetrics ? (
                    <input type="number" min={0} max={100} value={m.current}
                      onChange={e => setMetrics(prev => prev.map((x, j) => j === i ? { ...x, current: Number(e.target.value) } : x))}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                  ) : (
                    <span className="text-sm font-bold text-gray-900">{m.current}{m.unit}</span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    m.status === 'on_track' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    m.status === 'below' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                    {m.status === 'on_track' ? '✅ On Track' : m.status === 'below' ? '⚠️ Below Target' : '🔶 Moderate'}
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  m.status === 'on_track' ? 'bg-emerald-500' : m.status === 'below' ? 'bg-amber-400' : 'bg-orange-400'
                }`} style={{ width: `${m.current}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tracking Sheets ──────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            {([['tasks', 'Task Tracker'], ['reviews', 'Review Tracker'], ['progress', 'Progress Dashboard']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveSubTab(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${activeSubTab === key ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* ── Task Tracker ── */}
          {activeSubTab === 'tasks' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {['ID', 'Task Name', 'Assigned To', 'Status', 'Due Date', 'Completion', ''].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => {
                      const isEd = editingTaskId === task.ID
                      return (
                        <tr key={task.ID} className={`border-b border-gray-100 transition-colors ${isEd ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                          <td className="py-3 px-4 text-xs text-gray-500 font-medium">{task.ID}</td>
                          {isEd && taskDraft ? (
                            <>
                              <td className="py-2 px-4"><input value={taskDraft.Name} onChange={e => setTaskDraft({...taskDraft, Name: e.target.value})} className={inputCls} /></td>
                              <td className="py-2 px-4"><input value={taskDraft.AssignedTo} onChange={e => setTaskDraft({...taskDraft, AssignedTo: e.target.value})} className={inputCls} /></td>
                              <td className="py-2 px-4">
                                <select value={taskDraft.Status} onChange={e => setTaskDraft({...taskDraft, Status: e.target.value})} className={smSelectCls}>
                                  {['Pending','In Progress','Done'].map(s => <option key={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="py-2 px-4"><input value={taskDraft.DueDate} onChange={e => setTaskDraft({...taskDraft, DueDate: e.target.value})} className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                              <td className="py-2 px-4"><input type="number" min={0} max={100} value={taskDraft.Completion} onChange={e => setTaskDraft({...taskDraft, Completion: Number(e.target.value)})} className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                              <td className="py-2 px-4">
                                <div className="flex gap-1">
                                  <button onClick={saveTask} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700">Save</button>
                                  <button onClick={cancelTask} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 font-semibold text-gray-900">{task.Name}</td>
                              <td className="py-3 px-4 text-gray-600">{task.AssignedTo}</td>
                              <td className="py-3 px-4">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${taskStatusColor(task.Status)}`}>
                                  {taskStatusIcon(task.Status)} {task.Status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs">{task.DueDate}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-14 rounded-full bg-gray-100 h-2 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${task.Completion}%` }} />
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">{task.Completion}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1">
                                  <button onClick={() => startEditTask(task)} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">Edit</button>
                                  <button onClick={() => deleteTask(task.ID)} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200">✕</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                    {addingTask && (
                      <tr className="border-b border-emerald-100 bg-emerald-50/30">
                        <td className="py-2 px-4 text-xs text-gray-400">NEW</td>
                        <td className="py-2 px-4"><input placeholder="Task name" value={newTask.Name || ''} onChange={e => setNewTask({...newTask, Name: e.target.value})} className={inputCls} /></td>
                        <td className="py-2 px-4"><input placeholder="Assigned to" value={newTask.AssignedTo || ''} onChange={e => setNewTask({...newTask, AssignedTo: e.target.value})} className={inputCls} /></td>
                        <td className="py-2 px-4">
                          <select value={newTask.Status || 'Pending'} onChange={e => setNewTask({...newTask, Status: e.target.value})} className={smSelectCls}>
                            {['Pending','In Progress','Done'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-4"><input placeholder="Apr 30" value={newTask.DueDate || ''} onChange={e => setNewTask({...newTask, DueDate: e.target.value})} className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" /></td>
                        <td className="py-2 px-4"><input type="number" min={0} max={100} placeholder="0" value={newTask.Completion || ''} onChange={e => setNewTask({...newTask, Completion: Number(e.target.value)})} className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" /></td>
                        <td className="py-2 px-4">
                          <div className="flex gap-1">
                            <button onClick={addTask} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Add</button>
                            <button onClick={() => { setAddingTask(false); setNewTask({}) }} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!addingTask && (
                <button onClick={() => setAddingTask(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  + Add Task
                </button>
              )}
            </div>
          )}

          {/* ── Review Tracker ── */}
          {activeSubTab === 'reviews' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {['ID', 'Review Type', 'Reviewer', 'Review Date', 'Status', 'Notes', ''].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map(review => {
                      const isEd = editingReviewId === review.ID
                      return (
                        <tr key={review.ID} className={`border-b border-gray-100 transition-colors ${isEd ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                          <td className="py-3 px-4 text-xs text-gray-500 font-medium">{review.ID}</td>
                          {isEd && reviewDraft ? (
                            <>
                              <td className="py-2 px-4"><input value={reviewDraft.Type} onChange={e => setReviewDraft({...reviewDraft, Type: e.target.value})} className={inputCls} /></td>
                              <td className="py-2 px-4"><input value={reviewDraft.Reviewer} onChange={e => setReviewDraft({...reviewDraft, Reviewer: e.target.value})} className={inputCls} /></td>
                              <td className="py-2 px-4"><input value={reviewDraft.Date} onChange={e => setReviewDraft({...reviewDraft, Date: e.target.value})} className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                              <td className="py-2 px-4">
                                <select value={reviewDraft.Status} onChange={e => setReviewDraft({...reviewDraft, Status: e.target.value})} className={smSelectCls}>
                                  {['Pending','Approved','Rejected'].map(s => <option key={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="py-2 px-4"><input value={reviewDraft.Notes} onChange={e => setReviewDraft({...reviewDraft, Notes: e.target.value})} className={inputCls} /></td>
                              <td className="py-2 px-4">
                                <div className="flex gap-1">
                                  <button onClick={saveReview} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700">Save</button>
                                  <button onClick={cancelReview} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 font-semibold text-gray-900">{review.Type}</td>
                              <td className="py-3 px-4 text-gray-700">{review.Reviewer}</td>
                              <td className="py-3 px-4 text-gray-600 text-xs">{review.Date}</td>
                              <td className="py-3 px-4">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${reviewStatusColor(review.Status)}`}>
                                  {review.Status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs">{review.Notes}</td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1">
                                  <button onClick={() => startEditReview(review)} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">Edit</button>
                                  <button onClick={() => deleteReview(review.ID)} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200">✕</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                    {addingReview && (
                      <tr className="border-b border-emerald-100 bg-emerald-50/30">
                        <td className="py-2 px-4 text-xs text-gray-400">NEW</td>
                        <td className="py-2 px-4"><input placeholder="Review type" value={newReview.Type || ''} onChange={e => setNewReview({...newReview, Type: e.target.value})} className={inputCls} /></td>
                        <td className="py-2 px-4"><input placeholder="Reviewer" value={newReview.Reviewer || ''} onChange={e => setNewReview({...newReview, Reviewer: e.target.value})} className={inputCls} /></td>
                        <td className="py-2 px-4"><input placeholder="Apr 30" value={newReview.Date || ''} onChange={e => setNewReview({...newReview, Date: e.target.value})} className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" /></td>
                        <td className="py-2 px-4">
                          <select value={newReview.Status || 'Pending'} onChange={e => setNewReview({...newReview, Status: e.target.value})} className={smSelectCls}>
                            {['Pending','Approved','Rejected'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-4"><input placeholder="Notes" value={newReview.Notes || ''} onChange={e => setNewReview({...newReview, Notes: e.target.value})} className={inputCls} /></td>
                        <td className="py-2 px-4">
                          <div className="flex gap-1">
                            <button onClick={addReview} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Add</button>
                            <button onClick={() => { setAddingReview(false); setNewReview({}) }} className="rounded border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!addingReview && (
                <button onClick={() => setAddingReview(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  + Add Review
                </button>
              )}
            </div>
          )}

          {/* ── Progress Dashboard ── */}
          {activeSubTab === 'progress' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/30 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Overall Completion</p>
                  <div className="flex items-end gap-4">
                    <div className="flex-1 h-4 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${overallCompletion}%` }} />
                    </div>
                    <span className="text-3xl font-bold text-blue-600 flex-shrink-0">{overallCompletion}%</span>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Timeline Health</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                    🟢 On Track
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/30 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Team Efficiency</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700">
                    🟡 Moderate
                  </span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/30 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Task Backlog</p>
                  <p className="text-3xl font-bold text-gray-900">{tasks.filter(t => t.Status === 'Pending').length}</p>
                  <p className="text-xs text-gray-500 mt-1">pending tasks</p>
                </div>
              </div>

              {/* Milestone Progress */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100/30">
                  <h4 className="text-sm font-bold text-gray-900">Milestone Progress</h4>
                </div>
                <div className="p-5 space-y-3">
                  {milestones.slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m['Milestone']} — {m['Milestone Description'] || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${m['% Complete'] || 0}%` }} />
                          </div>
                          <span className="text-[11px] text-gray-500">{m['% Complete'] || 0}%</span>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                        m['Current Status'] === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        m['Current Status'] === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        m['Current Status'] === 'Delayed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {m['Current Status'] || 'Pending'}
                      </span>
                    </div>
                  ))}
                  {milestones.length === 0 && <p className="text-sm text-gray-400 italic">No milestones defined</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
