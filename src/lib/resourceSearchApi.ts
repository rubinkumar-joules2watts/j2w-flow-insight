import { apiUrl } from "@/lib/api"

export interface ActiveProject {
  project_id: string
  project_name: string
  engagement_level: number
  start_date: string | null
  end_date: string | null
}

export interface ResourceSearchMember {
  id: string
  name: string
  role: string
  initials: string
  color_hex: string
  skills: string[]
  available_bandwidth: number
  committed_bandwidth: number
  skill_score: number
  role_score: number
  matched_skills: string[]
  partial_skills: string[]
  composite_score: number
  active_projects: ActiveProject[]
}

export interface ResourceSearchResponse {
  members: ResourceSearchMember[]
  total: number
}

export interface AutoAllocateResource {
  id: string
  role: string
  skills: string[]
  bandwidth: number
}

export interface AutoAllocateAssignment {
  type: "internal"
  id: string
  name: string
  role: string
  bw: number
  score: number
}

export interface AutoAllocateResult {
  resourceId: string
  role: string
  requiredBW: number
  assignments: AutoAllocateAssignment[]
  tbdBW: number
  status: "matched" | "partial"
}

export async function searchResources(params: {
  role?: string
  skills: string[]
  bandwidth_needed: number
  project_start?: string
  project_end?: string
}): Promise<ResourceSearchResponse> {
  const res = await fetch(apiUrl("/api/resources/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error("Failed to search resources")
  return res.json()
}

export async function autoAllocateResources(params: {
  resources: AutoAllocateResource[]
  project_start?: string
  project_end?: string
}): Promise<AutoAllocateResult[]> {
  const res = await fetch(apiUrl("/api/resources/auto-allocate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error("Failed to auto-allocate resources")
  return res.json()
}
