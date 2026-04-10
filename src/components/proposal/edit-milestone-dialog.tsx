'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'


interface EditMilestoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  milestone: any
  onSave: (updatedMilestone: any) => void
}

export default function EditMilestoneDialog({
  open,
  onOpenChange,
  milestone,
  onSave,
}: EditMilestoneDialogProps) {
  const [formData, setFormData] = useState(milestone)

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSave = () => {
    onSave(formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onValueChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Milestone - {milestone?.Milestone}</DialogTitle>
          <DialogDescription>
            Update milestone details and timeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="description">Description</label>
            <Input
              id="description"
              value={formData['Milestone Description'] || ''}
              onChange={(e) => handleChange('Milestone Description', e.target.value)}
              placeholder="Enter milestone description"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="plannedStart">Planned Start</label>
            <Input
              id="plannedStart"
              value={formData['Planned Start'] || ''}
              onChange={(e) => handleChange('Planned Start', e.target.value)}
              placeholder="e.g. 12-Dec-25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="plannedEnd">Planned End</label>
            <Input
              id="plannedEnd"
              value={formData['Planned End'] || ''}
              onChange={(e) => handleChange('Planned End', e.target.value)}
              placeholder="e.g. 10-Jan-26"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="actualStart">Actual Start</label>
            <Input
              id="actualStart"
              value={formData['Actual Start'] || ''}
              onChange={(e) => handleChange('Actual Start', e.target.value)}
              placeholder="e.g. 2-Feb-26"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="actualEnd">Actual End / ETA</label>
            <Input
              id="actualEnd"
              value={formData['Actual End / ETA'] || ''}
              onChange={(e) => handleChange('Actual End / ETA', e.target.value)}
              placeholder="e.g. 7-Feb-26"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="completion">% Complete</label>
            <Input
              id="completion"
              type="number"
              value={formData['% Complete'] || 0}
              onChange={(e) => handleChange('% Complete', parseInt(e.target.value))}
              min="0"
              max="100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="status">Current Status</label>
            <Input
              id="status"
              value={formData['Current Status'] || ''}
              onChange={(e) => handleChange('Current Status', e.target.value)}
              placeholder="e.g. Completed, In Progress, Delayed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="remarks">Remarks</label>
            <Textarea
              id="remarks"
              value={formData['Remarks'] || ''}
              onChange={(e) => handleChange('Remarks', e.target.value)}
              placeholder="Enter remarks"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
