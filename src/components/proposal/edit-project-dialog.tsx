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
import { Field, FieldLabel } from '@/components/ui/field'

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: any
  onSave: (updatedProject: any) => void
}

export default function EditProjectDialog({
  open,
  onOpenChange,
  project,
  onSave,
}: EditProjectDialogProps) {
  const [formData, setFormData] = useState(project)

  const handleChange = (field: string, value: string) => {
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
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details and information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <Field>
            <FieldLabel htmlFor="projectName">Project Name</FieldLabel>
            <Input
              id="projectName"
              value={formData['Project Name']}
              onChange={(e) => handleChange('Project Name', e.target.value)}
              placeholder="Enter project name"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="client">Client</FieldLabel>
            <Input
              id="client"
              value={formData['Client'] || ''}
              onChange={(e) => handleChange('Client', e.target.value)}
              placeholder="Enter client name"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="projectType">Project Type</FieldLabel>
            <Input
              id="projectType"
              value={formData['Project Type']}
              onChange={(e) => handleChange('Project Type', e.target.value)}
              placeholder="Enter project type"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="serviceType">Service Type</FieldLabel>
            <Input
              id="serviceType"
              value={formData['Service Type']}
              onChange={(e) => handleChange('Service Type', e.target.value)}
              placeholder="e.g. Outcome, Governance"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="deliveryManager">Delivery Manager</FieldLabel>
            <Input
              id="deliveryManager"
              value={formData['Delivery Manager']}
              onChange={(e) => handleChange('Delivery Manager', e.target.value)}
              placeholder="Enter delivery manager name"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="clientSPOC">Client SPOC</FieldLabel>
            <Input
              id="clientSPOC"
              value={formData['Client SPOC']}
              onChange={(e) => handleChange('Client SPOC', e.target.value)}
              placeholder="Enter client SPOC"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="scope">Scope</FieldLabel>
            <Textarea
              id="scope"
              value={formData['Scope']}
              onChange={(e) => handleChange('Scope', e.target.value)}
              placeholder="Enter project scope"
              rows={3}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="orderDetails">Order Details</FieldLabel>
            <Input
              id="orderDetails"
              value={formData['Order Details']}
              onChange={(e) => handleChange('Order Details', e.target.value)}
              placeholder="e.g. PO-2025-0001 | $250,000"
            />
          </Field>
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
