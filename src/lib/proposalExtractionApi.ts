import { apiUrl } from "@/lib/api"

export interface ExtractedProposalResponse {
  metadata: {
    filename: string
    file_type: string
    file_size: number
    processing_ms: number
    pages: number
  }
  proposal: {
    project_name: string
    client?: string | null
    milestones: Array<{
      id: string
      name: string
      startDate?: string | null
      endDate?: string | null
    }>
    resources: Array<{
      id: string
      role: string
      skills: string[]
      responsibilities?: string
      bandwidth?: number
    }>
    warnings?: string[]
  }
}

function normalizeApiError(payload: any): string {
  if (typeof payload?.detail === "string") return payload.detail
  if (typeof payload?.error === "string") return payload.error
  return "Unable to analyze document"
}

export async function extractProposalDocument(file: File): Promise<ExtractedProposalResponse> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(apiUrl("/api/documents/extract"), {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(normalizeApiError(payload))
  }

  return (await response.json()) as ExtractedProposalResponse
}