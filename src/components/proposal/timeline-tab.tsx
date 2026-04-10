import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import EditMilestoneDialog from './edit-milestone-dialog'

interface TimelineTabProps {
  project: any
  onUpdate?: (updatedProject: any) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed':
      return 'bg-green-100 text-green-800'
    case 'In Progress':
      return 'bg-blue-100 text-blue-800'
    case 'Delayed':
    case 'On Hold':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

const getFlagColor = (flag: string) => {
  switch (flag) {
    case 'Green':
      return '🟢'
    case 'Amber':
      return '🟡'
    case 'Red':
      return '🔴'
    default:
      return '⚪'
  }
}

export default function TimelineTab({ project, onUpdate }: TimelineTabProps) {
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null)
  const [editMilestoneOpen, setEditMilestoneOpen] = useState(false)

  const handleEditMilestone = (milestone: any) => {
    setSelectedMilestone(milestone)
    setEditMilestoneOpen(true)
  }

  const handleSaveMilestone = (updatedMilestone: any) => {
    const updatedMilestones = project['Milestones'].map((m: any) =>
      m['Milestone'] === updatedMilestone['Milestone'] ? updatedMilestone : m
    )
    const updatedProject = { ...project, Milestones: updatedMilestones }
    onUpdate?.(updatedProject)
  }

  const milestones = project['Milestones'] || []
  const totalDays = milestones.reduce((sum: number, m: any) => {
    const start = new Date(m['Planned Start'] || '2025-01-01')
    const end = new Date(m['Planned End'] || '2025-01-01')
    return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }, 0)

  const completionPercentage = milestones.length > 0
    ? Math.round(milestones.reduce((sum: number, m: any) => sum + (m['% Complete'] || 0), 0) / milestones.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Timeline Overview</CardTitle>
          <CardDescription>Gantt-style milestone view</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Overall Completion</span>
              <span className="text-sm font-bold text-slate-900">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Timeline Legend */}
          <div className="flex gap-6 pt-4 text-sm border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">●</span>
              <span className="text-slate-600">Proposed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">◆</span>
              <span className="text-slate-600">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-600">▲</span>
              <span className="text-slate-600">Actual</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Milestone Details</CardTitle>
          <CardDescription>{milestones.length} total milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Milestone</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Progress</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Planned</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Flag</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{milestone['Milestone']}</td>
                    <td className="py-3 px-4 text-slate-700">{milestone['Milestone Description']}</td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(milestone['Current Status'])}>
                        {milestone['Current Status']}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${milestone['% Complete']}%` }}
                          />
                        </div>
                        <span className="text-slate-600 text-xs font-medium">
                          {milestone['% Complete']}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {milestone['Planned Start']} - {milestone['Planned End']}
                    </td>
                    <td className="py-3 px-4 text-lg">{getFlagColor(milestone['Milestone Flag'])}</td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditMilestone(milestone)}
                        className="text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Details Cards */}
      <div className="space-y-4">
        {milestones.slice(0, 3).map((milestone: any, idx: number) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    {milestone['Milestone']} - {milestone['Milestone Description']}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {milestone['Planned Start']} to {milestone['Planned End']}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditMilestone(milestone)}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    Edit
                  </Button>
                  <div className="text-xl">{getFlagColor(milestone['Milestone Flag'])}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Status</p>
                  <Badge className={`${getStatusColor(milestone['Current Status'])} mt-1`}>
                    {milestone['Current Status']}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Completion</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">{milestone['% Complete']}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Days Variance</p>
                  <p className={`text-base font-semibold mt-1 ${milestone['Days Variance'] > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {milestone['Days Variance'] > 0 ? '+' : ''}{milestone['Days Variance']} days
                  </p>
                </div>
              </div>

              {milestone['Remarks'] && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-sm text-slate-600 font-medium mb-1">Remarks</p>
                  <p className="text-slate-700">{milestone['Remarks']}</p>
                </div>
              )}

              {milestone['Blocker (Y/N)'] === 'Y' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Blocker: {milestone['Blocker Owner']}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Milestone Dialog */}
      {selectedMilestone && (
        <EditMilestoneDialog
          open={editMilestoneOpen}
          onOpenChange={setEditMilestoneOpen}
          milestone={selectedMilestone}
          onSave={handleSaveMilestone}
        />
      )}
    </div>
  )
}
