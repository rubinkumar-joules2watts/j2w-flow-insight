# Project Proposal & Planning — Full UI Flow (v2)

---

## App Structure Overview

```
[ Upload Document ]
        ↓
  (AI Parses Document)
        ↓
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Extraction Review                                   │
│    Section 1 — Milestone Timeline                            │
│    Section 2 — Resource & Skill Extraction                   │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Resource Allocation (Manual Search & Review)        │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: Auto Allocation + Analysis + Save                   │
└──────────────────────────────────────────────────────────────┘
```

---

## STEP 1 — Extraction Review

> After document upload and AI parse, user lands here to review and edit all extracted data before proceeding.

---

### Section 1 — Milestone Timeline

**Layout: Editable Table**

Rules:
- Default duration = 7 days per milestone
- When a higher milestone's Start/End date is edited → all subsequent milestones auto-shift accordingly (cascade update)
- User can toggle between Exact Date or Relative (+N days) per milestone
- [ + Add Milestone ] to add new rows manually

```
┌────────────────────────────────────────────────────────────────────────┐
│  📅 Milestone Timeline                          [ + Add Milestone ]    │
│                                                                        │
│  ┌───┬──────────────────────┬─────────────┬─────────────┬──────────┐  │
│  │ # │ Milestone Name       │ Start Date  │ End Date    │ Duration │  │
│  ├───┼──────────────────────┼─────────────┼─────────────┼──────────┤  │
│  │ 1 │ [Verification & SOW] │ [12-Dec-25] │ [10-Jan-26] │ +29 days │  │
│  │   │ ✏️ editable           │ 📅 editable │ 📅 editable │ auto     │  │
│  ├───┼──────────────────────┼─────────────┼─────────────┼──────────┤  │
│  │ 2 │ [KPI & Mock Dashboard│ [11-Jan-26] │ [15-Jan-26] │ +4 days  │  │
│  │   │ ✏️ editable           │ 📅 auto     │ 📅 editable │ auto     │  │
│  ├───┼──────────────────────┼─────────────┼─────────────┼──────────┤  │
│  │ 3 │ [Integration & Test] │ [16-Jan-26] │ [TBD]       │ +7 days  │  │
│  │   │ ✏️ editable           │ 📅 auto     │ 📅 editable │ auto     │  │
│  └───┴──────────────────────┴─────────────┴─────────────┴──────────┘  │
│                                                                        │
│  ⚠️  Editing M1 End Date will auto-shift M2 Start → M3 Start          │
│                                                                        │
│  Date Mode per milestone:  ● Exact Date   ○ Relative (+N days)        │
└────────────────────────────────────────────────────────────────────────┘
```

**Cascade Logic:**
```
User edits M1 End Date
    └─→ M2 Start = M1 End + 1 day  (auto)
    └─→ M2 End   = M2 Start + M2 duration  (auto)
    └─→ M3 Start = M2 End + 1 day  (auto)
    └─→ ... and so on for all subsequent milestones
```

---

### Section 2 — Extracted Resources & Skills

**Layout: Editable Table**

AI extracts required resources, their skill sets, and recommended bandwidth from the document. User can edit all fields.

```
┌────────────────────────────────────────────────────────────────────────┐
│  👥 Required Resources                          [ + Add Resource ]     │
│                                                                        │
│  ┌─────────┬──────────────────────┬─────────────────────┬──────────┐  │
│  │Resource │ Role / Skill Set     │ Responsibilities    │Bandwidth │  │
│  ├─────────┼──────────────────────┼─────────────────────┼──────────┤  │
│  │   R1    │ DevOps Engineer      │ CI/CD, Infra Setup  │   50%    │  │
│  │         │ ✏️ editable           │ ✏️ editable          │ ✏️ edit  │  │
│  ├─────────┼──────────────────────┼─────────────────────┼──────────┤  │
│  │   R2    │ Data Engineer        │ Pipeline, Snowflake │   100%   │  │
│  │         │ ✏️ editable           │ ✏️ editable          │ ✏️ edit  │  │
│  ├─────────┼──────────────────────┼─────────────────────┼──────────┤  │
│  │   R3    │ QA / Test Engineer   │ Integration Testing │   30%    │  │
│  │         │ ✏️ editable           │ ✏️ editable          │ ✏️ edit  │  │
│  ├─────────┼──────────────────────┼─────────────────────┼──────────┤  │
│  │   R4    │ Solution Architect   │ HLD, Tech Guidance  │   20%    │  │
│  │         │ ✏️ editable           │ ✏️ editable          │ ✏️ edit  │  │
│  └─────────┴──────────────────────┴─────────────────────┴──────────┘  │
│                                                                        │
│  [ Save & Proceed to Step 2 → ]                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Sample data from uploaded projects:**

| Resource | Project | Skill | Bandwidth |
|---|---|---|---|
| Mriganka | Novartis ITSE | Data Analysis, Dashboard | 10% |
| Dhinakar | GE Gate Test Maintenance | Automation, QA | 40% |
| Mriganka | GE Gate Test Maintenance | QA Support | 30% |
| Dhinakar | CD Automation | Automation | 40% |
| Sanju | GE HC LTS | Delivery Management | 25% |
| Sharath | GE HC LTS | Partner — Tech | 15% |
| Dhinakar | GE HC LTS | Automation | 40% |
| Mahidhar | GE HC LTS | IGS Resource | 100% |
| Kartika | GE HC LTS | Development | 50% |
| Sanju | GE AVS Scrum | Delivery Management | 25% |
| Sanju | Lowes SEO Roadmap | Delivery Management | 25% |

---

## STEP 2 — Resource Allocation (Manual Search & Review)

> Two-panel view. Left = Required resources from Step 1. Right = Search and browse internal team for each role.

**Purpose:** Before auto-allocation runs, user can manually search and preview internal candidates for each required resource slot.

---

### Layout

```
┌──────────────────────────┬─────────────────────────────────────────────┐
│  LEFT PANEL              │  RIGHT PANEL                                │
│  Required Resources      │  Internal Team Search                       │
│  (from Step 1 Section 2) │                                             │
│                          │  Search: [ DevOps Engineer 🔍 ]             │
│  R1 — DevOps     50% ←── │ ──(selected)──────────────────────────────  │
│  R2 — Data Eng   100%    │                                             │
│  R3 — QA         30%     │  Results for: DevOps Engineer               │
│  R4 — Architect  20%     │  Filtered by: Project Timeline              │
│                          │  (Dec 25 – Jan 26)                          │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

### Left Panel — Required Resources List

```
Required Resources for this Project:
Timeline: Dec 12, 2025 – Jan 26, 2026

  R1  DevOps Engineer         50%  bandwidth needed   [ Search →]
  R2  Data Engineer          100%  bandwidth needed   [ Search →]
  R3  QA / Test Engineer      30%  bandwidth needed   [ Search →]
  R4  Solution Architect      20%  bandwidth needed   [ Search →]
```

---

### Right Panel — Internal Team Results (on role click / search)

```
Searching for: DevOps Engineer
Project Timeline: Dec 12, 2025 – Jan 26, 2026
─────────────────────────────────────────────────────────────────────

  Resource         Bandwidth (Available)    Skills
  ──────────────────────────────────────────────────────────────────
  Balaji           70%  ██████████████░░░░  DevOps, CI/CD, Docker
  Dhinakar         20%  ████░░░░░░░░░░░░░░  Automation, DevOps (partial)
  Mriganka         60%  ████████████░░░░░░  Data Eng, DevOps (partial)

  Note: Bandwidth shown is availability during the project timeline
        (other project allocations already deducted)
─────────────────────────────────────────────────────────────────────
```

Each result row is expandable to see full skill set. No assignment happens here — this is preview only.

```
  ▼ Balaji  (expanded)
  ──────────────────────────────────────────────────────────────────
  Available Bandwidth:  70%
  Current Projects:     GE Gate Test (30%)
  Skills:               ✅ DevOps  ✅ CI/CD  ✅ Docker
                        ✅ Kubernetes  ⚠️ Terraform (Partial)
  Timeline Conflict:    None — fully available Dec 12 onwards
  ──────────────────────────────────────────────────────────────────
```

**[ Proceed to Auto Allocation → ]**

---

## STEP 3 — Auto Allocation + Analysis + Save

> Auto-allocation algorithm runs and finds the best internal fit for each required resource. TBD is shown where no match is found. All results are manually editable. External resources and Technology Partners are also shown here.

---

### Step 3A — Auto Allocation Results Table

**Algorithm logic:**
1. Match skill set of required role → internal team skills
2. Check bandwidth availability during project timeline
3. Score each candidate (skill match % × bandwidth availability)
4. Assign highest scorer → if no match or bandwidth < required → mark TBD

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  🤖 Auto Allocation Results                                                          │
│                                                                                      │
│  ┌────┬──────────────────┬──────────┬────────────┬──────────────────┬────────────┐  │
│  │Req │ Role / Skill     │ Required │ Assigned   │ Type             │ Bandwidth  │  │
│  │    │                  │ BW       │ Resource   │                  │ Matched    │  │
│  ├────┼──────────────────┼──────────┼────────────┼──────────────────┼────────────┤  │
│  │ R1 │ DevOps Engineer  │  50%     │ Balaji     │ 🟢 Internal      │  50% ✅    │  │
│  ├────┼──────────────────┼──────────┼────────────┼──────────────────┼────────────┤  │
│  │ R2 │ Data Engineer    │  100%    │ Mriganka   │ 🟢 Internal      │  60% ⚠️    │  │
│  │    │                  │          │ + TBD(40%) │ ⚪ TBD           │  40% TBD   │  │
│  ├────┼──────────────────┼──────────┼────────────┼──────────────────┼────────────┤  │
│  │ R3 │ QA Engineer      │  30%     │ Dhinakar   │ 🟢 Internal      │  20% ⚠️    │  │
│  │    │                  │          │ + TBD(10%) │ ⚪ TBD           │  10% TBD   │  │
│  ├────┼──────────────────┼──────────┼────────────┼──────────────────┼────────────┤  │
│  │ R4 │ Solution Arch.   │  20%     │ TBD        │ ⚪ TBD           │  — TBD     │  │
│  └────┴──────────────────┴──────────┴────────────┴──────────────────┴────────────┘  │
│                                                                                      │
│  ✏️ All rows are manually editable — click any cell to edit                          │
│  ⚪ TBD rows can be replaced with internal or external resource manually             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 3B — TBD Analysis & Suggested Technology Partners

For every TBD slot, show:
- Why no internal match was found (skill gap / bandwidth gap)
- Suggested external Technology Partners from the DB

```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚪ TBD Analysis                                                        │
│                                                                        │
│  R2 — Data Engineer (40% remaining)                                    │
│  Reason: Mriganka covers 60%; no other internal resource has           │
│          sufficient Data Engineering skill + bandwidth available       │
│                                                                        │
│  💡 Suggested Technology Partners:                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Partner Name     Firm              Skills         Availability  │  │
│  │  Kiran Mehta      CloudEdge         Data Eng       Available ✅   │  │
│  │  Priya Nair       FreelanceDB       Data Eng       Mar 10+ ⚠️    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  R4 — Solution Architect (20% — no internal match)                     │
│  Reason: All architects at full bandwidth during project timeline      │
│                                                                        │
│  💡 Suggested Technology Partners:                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Partner Name     Firm              Skills         Availability  │  │
│  │  Sharath          Partner (GE HC)   Arch, Tech     25% free ⚠️   │  │
│  │  Mahidhar         IGS               Arch, Infra    Available ✅   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Step 3C — External Resources Panel

> Same card layout as internal, but for external/contract resources already in the DB + those added from specific projects (GE AVS Scrum, Lowes, etc.)

```
External / Contract Resources Available
[ Filter by Skill 🔽 ]  [ Filter by Availability 🔽 ]
─────────────────────────────────────────────────────────────────────

  👤 Sharath                                        🔵 External Partner
  ─────────────────────────────────────────────────────────────────
  Currently on:   GE HC LTS (15%)
  Available BW:   85%   █████████████████░░░
  Skills:         ✅ Tech Architecture  ✅ System Design
                  ⚠️  DevOps (Partial)
  Timeline:       Available from Dec 12 ✅
  [ + Assign to Slot ]

  ─────────────────────────────────────────────────────────────────

  👤 Mahidhar                                       🟡 IGS Contract
  ─────────────────────────────────────────────────────────────────
  Currently on:   GE HC LTS (100%)
  Available BW:   0%    ░░░░░░░░░░░░░░░░░░░░
  Skills:         ✅ Infrastructure  ✅ Architecture  ✅ DevOps
  Timeline:       ⚠️  Fully occupied — check after GE HC LTS ends
  [ + Assign to Slot ]

  ─────────────────────────────────────────────────────────────────

  👤 Kartika                                        🟡 Contract
  ─────────────────────────────────────────────────────────────────
  Currently on:   GE HC LTS (50%)
  Available BW:   50%   ██████████░░░░░░░░░░
  Skills:         ✅ Development  ✅ QA  ⚠️  DevOps (Partial)
  Timeline:       Available Dec 12 ✅
  [ + Assign to Slot ]

  ─────────────────────────────────────────────────────────────────

  (Add more external from Lowes team / GE AVS Scrum as uploaded)
```

---

### Step 3D — Final Complete Picture

Full allocation summary before saving:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ✅ Final Resource Allocation Summary                                            │
│  Project: ITSE Dashboard   |   Timeline: Dec 12, 2025 – Jan 26, 2026           │
│                                                                                  │
│  ┌────┬──────────────────┬────────────┬──────────────┬──────────┬────────────┐  │
│  │ #  │ Role             │ Assigned   │ Type         │ BW Alloc │ Status     │  │
│  ├────┼──────────────────┼────────────┼──────────────┼──────────┼────────────┤  │
│  │ R1 │ DevOps Engineer  │ Balaji     │ 🟢 Internal  │  50%     │ ✅ Matched │  │
│  ├────┼──────────────────┼────────────┼──────────────┼──────────┼────────────┤  │
│  │ R2 │ Data Engineer    │ Mriganka   │ 🟢 Internal  │  60%     │ ⚠️ Partial │  │
│  │    │                  │ Kiran M.   │ 🔵 External  │  40%     │ ✅ Filled  │  │
│  ├────┼──────────────────┼────────────┼──────────────┼──────────┼────────────┤  │
│  │ R3 │ QA Engineer      │ Dhinakar   │ 🟢 Internal  │  20%     │ ⚠️ Partial │  │
│  │    │                  │ Kartika    │ 🟡 Contract  │  10%     │ ✅ Filled  │  │
│  ├────┼──────────────────┼────────────┼──────────────┼──────────┼────────────┤  │
│  │ R4 │ Solution Arch.   │ Sharath    │ 🔵 External  │  20%     │ ✅ Matched │  │
│  └────┴──────────────────┴────────────┴──────────────┴──────────┴────────────┘  │
│                                                                                  │
│  All slots:  ✅ Filled (4/4)    Internal: 2   External: 1   Contract: 1         │
│                                                                                  │
│  ✏️ Still editable — click any row to change assignment                          │
│                                                                                  │
│  [ ← Back to Edit ]                          [ 💾 Save & Finalize Proposal ]    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Full Step-by-Step Flow Summary

```
UPLOAD DOCUMENT
    └─→ AI extracts: milestones, resources, skills, bandwidth

STEP 1 — EXTRACTION REVIEW
    ├─→ Section 1: Review & edit milestone table
    │       └─→ Cascade logic: editing any milestone shifts all below it
    └─→ Section 2: Review & edit required resources + skills + bandwidth
            └─→ [ Save & Proceed ]

STEP 2 — RESOURCE ALLOCATION (MANUAL PREVIEW)
    ├─→ Left panel: Required resources list (from Step 1)
    └─→ Right panel: Search internal team by role
            └─→ See bandwidth + skills for project timeline
            └─→ Preview only — no assignment yet
            └─→ [ Proceed to Auto Allocation ]

STEP 3 — AUTO ALLOCATION + ANALYSIS + SAVE
    ├─→ Step 3A: Auto-allocation table
    │       └─→ Best internal fit assigned per role
    │       └─→ TBD shown where no match found
    │       └─→ Fully manually editable
    ├─→ Step 3B: TBD Analysis
    │       └─→ Reason for TBD (skill gap / bandwidth gap)
    │       └─→ Suggested Technology Partners from DB
    ├─→ Step 3C: External Resources Panel
    │       └─→ All external/contract resources with BW + skills
    │       └─→ Assign to any open or TBD slot
    ├─→ Step 3D: Final Complete Picture
    │       └─→ Full summary: all roles, assigned names, type, BW, status
    └─→ [ 💾 Save & Finalize ]
```

---

## Data Flow Between Steps

```
Upload
  │
  └─→ AI Parse
          │
          ├─→ Step 1, Section 1: Milestones (dates, durations)
          │         cascade edit logic active
          │
          ├─→ Step 1, Section 2: Resources (role, skill, bandwidth %)
          │
          ├─→ Step 2: Resources from S1 shown in left panel
          │           Internal team DB queried for right panel
          │
          └─→ Step 3: Auto-alloc runs on Step 1 resource requirements
                      vs Internal DB (skill + bandwidth + timeline)
                      TBDs filled from External DB + Partner suggestions
                      Final summary saved
```

---

## Badge / Status Reference

| Badge | Meaning |
|---|---|
| 🟢 Internal | Full-time internal employee |
| 🟡 Contract | IGS / Fixed-term contractor |
| 🔵 External Partner | Agency / third-party / named partner |
| ⚪ TBD | No match found — to be determined |
| ✅ Matched | Fully allocated, skill + BW met |
| ⚠️ Partial | Allocated but bandwidth or skill partially met |
| ❌ Gap | Skill not available internally |

---

*End of Flow Document v2*