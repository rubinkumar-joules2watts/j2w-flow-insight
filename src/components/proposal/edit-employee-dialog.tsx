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


interface EditEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: any
  onSave: (updatedEmployee: any) => void
}

export default function EditEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSave,
}: EditEmployeeDialogProps) {
  const [formData, setFormData] = useState(employee)

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
          <DialogTitle>Edit Employee - {employee?.Name}</DialogTitle>
          <DialogDescription>
            Update employee details, skills, and availability
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="name">Name</label>
            <Input
              id="name"
              value={formData['Name']}
              onChange={(e) => handleChange('Name', e.target.value)}
              placeholder="Enter employee name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="role">Role</label>
            <Input
              id="role"
              value={formData['Role']}
              onChange={(e) => handleChange('Role', e.target.value)}
              placeholder="Enter role"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="status">Status</label>
            <Input
              id="status"
              value={formData['Status']}
              onChange={(e) => handleChange('Status', e.target.value)}
              placeholder="e.g. Internal, External Partner, Contract"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="skills">Skills</label>
            <Textarea
              id="skills"
              value={formData['Skills']}
              onChange={(e) => handleChange('Skills', e.target.value)}
              placeholder="Enter skills (comma separated)"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="available">Available %</label>
            <Input
              id="available"
              type="number"
              value={formData['Available']}
              onChange={(e) => handleChange('Available', parseInt(e.target.value))}
              min="0"
              max="100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="occupied">Occupied %</label>
            <Input
              id="occupied"
              type="number"
              value={formData['Occupied']}
              onChange={(e) => handleChange('Occupied', parseInt(e.target.value))}
              min="0"
              max="100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="currentProject">Current Project</label>
            <Input
              id="currentProject"
              value={formData['Current Project']}
              onChange={(e) => handleChange('Current Project', e.target.value)}
              placeholder="Enter current project"
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
