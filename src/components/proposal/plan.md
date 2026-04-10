# Project Proposal & Planning — Full UI Flow

---

## App Structure

```
[ Upload Document ]
        ↓
    (AI Parses Document)
        ↓
┌─────────────────────────────────────────────────────────────┐
│  TABS:  [Summary & Scope ●]  [Timeline]  [Resource]  [Governance]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Tab 1 — Summary & Scope (Default Active Tab)

### Section A: Document Upload & AI Parse

```
┌──────────────────────────────────────────────────┐
│   📄 Upload Proposal Document                    │
│   [ Drag & Drop or Browse ]  (.pdf / .docx)      │
│                                                  │
│   ✅ AI will auto-extract:                       │
│      - Project Name                              │
│      - Client Details                            │
│      - Scope                                     │
│      - Milestones                                │
│      - Resources                                 │
└──────────────────────────────────────────────────┘
```

**AI Parsing Flow:**
1. User uploads document
2. AI parses and extracts all structured fields
3. Fields are pre-filled in the form below
4. User can review and edit each field
5. On save → data flows into Timeline, Resource, Governance tabs

---

### Section B: Basic Proposal Details

| Field | Input Type | Description |
|---|---|---|
| Project Name | Text Input | Name of the project |
| Client Name | Text Input | Client organization name |
| Client Spokesperson / POC | Text Input + optional role tag | Primary contact person |
| Client Touchpoints | Multi-entry / Tag Input | All contact channels / persons |
| Project Delivery Manager | Dropdown / Search | Assign internal PDM |
| Project Scope | Rich Text / Textarea | Detailed scope description |
| Order Details | Text / Number | Order ID, value, PO number |

---

### Section C: AI-Generated Summary

```
┌──────────────────────────────────────────────────────────────┐
│  📝 Project Summary (AI Generated)                          │
│  ─────────────────────────────────────────────────────────  │
│  This project involves [Client Name] with an objective to   │
│  deliver [Scope]. The project is managed by [PDM] and is    │
│  expected to span [X weeks/months]. Key deliverables        │
│  include [milestones]. Resources required: [roles].         │
│                                                             │
│  [ Regenerate Summary ]  [ Edit Manually ]                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Tab 2 — Timeline

### Section A: Milestone Planner

**Input Mode Toggle:**
```
[ Week-wise ]  [ Phase-wise ]
```

**Milestone Entry Table:**

| # | Milestone Name | Start Date | End Date | Duration | Type |
|---|---|---|---|---|---|
| 1 | Milestone 1 | Mar 01, 2025 | Mar 07, 2025 | +7 days | Exact / Relative |
| 2 | Milestone 2 | Mar 08, 2025 | Mar 14, 2025 | +7 days | Relative |
| 3 | Milestone 3 | Mar 15, 2025 | Mar 28, 2025 | +14 days | Relative |
| + | [ Add Milestone ] | | | | |

**Rules:**
- Default duration = **7 days**
- Each milestone auto-starts from previous milestone's end date
- User can override to exact dates OR use relative (+7, +14 days)
- Supports **automatic progression** — changing Milestone 1 shifts all subsequent milestones

---

### Section B: Date Input Options

```
For each milestone:

  Start Date:
    ● Exact Date  [ Mar 01, 2025 📅 ]
    ○ Relative    [ +7 days from project start ]

  End Date:
    ● Exact Date  [ Mar 07, 2025 📅 ]
    ○ Relative    [ +7 days from start ]
```

---

### Section C: Timeline View (Gantt-style)

```
TIMELINE — March 2025
─────────────────────────────────────────────────────────────────
Milestone 1  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░  Mar 01–07
Milestone 2  ░░░░████░░░░░░░░░░░░░░░░░░░░░░░  Mar 08–14
Milestone 3  ░░░░░░░░████████░░░░░░░░░░░░░░░  Mar 15–28
─────────────────────────────────────────────────────────────────
             ● Proposed   ◆ Planned   ▲ Actual
```

**Note:** Timeline tab only shows milestones and date logic. No resource or governance data here.

---

## Tab 3 — Resource

### Layout: Two-Panel View

```
┌─────────────────────┬──────────────────────────────────────────┐
│  LEFT PANEL         │  RIGHT PANEL                             │
│  Required Roles     │  Matched Candidates                      │
│                     │                                          │
│  [ Architect ]  ←── │ ── selected → shows candidates          │
│       |             │                                          │
│  [ Sr. Developer ]  │  [ Internal ]  [ External ]  ← tabs     │
│       |             │                                          │
│  [ Jr. Developer ]  │  Candidate cards with score,            │
│       |             │  bandwidth, timeline, skills             │
│  [ Product Manager] │                                          │
└─────────────────────┴──────────────────────────────────────────┘
```

---

### Left Panel: Required Roles (Project Needs)

```
This Project Requires:

  ┌──────────────────┐
  │  🏗 Architect    │  ← clickable role card
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  👨‍💻 Sr. Developer │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  👨‍💻 Jr. Developer │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  📋 Product Mgr  │
  └──────────────────┘

  Total Required: 4 persons
```

---

### Right Panel: Candidates (on Role Click)

**Sub-tabs at top of right panel:**
```
[ Internal (Active ●) ]     [ External / Contract ]
```

Both tabs follow the **exact same layout and card structure** — only the pool of people changes.

---

#### Internal Tab Layout

```
[ Internal ● ]   [ External ]
─────────────────────────────────────────────────────────────────

  👤 Balaji Rajan                              🟢 Internal
  ─────────────────────────────────────────────────────────────
  Role: Solution Architect

  ⭐ Skill Match Score:  87 / 100
  ████████████████████░░░░  87%

  ─── Bandwidth ──────────────────────────────────────────────
  Available:  60%   ████████████░░░░░░░░
  Occupied:   40%   ████████░░░░░░░░░░░░   (Project X)

  ─── Timeline Allocation ────────────────────────────────────
  Project Timeline:  Mar 01 – Mar 30
  Can join:          Mar 01  ✅
  Conflict:          None

  ─── Full Skill Set ─────────────────────────────────────────
  ✅ AWS Solutions Architecture
  ✅ Microservices Design
  ✅ System Design & HLD
  ✅ Cloud Cost Optimization
  ⚠️  Kubernetes (Partial)
  ❌ ML/AI Architecture

  [ Assign to Project ]
  ─────────────────────────────────────────────────────────────

  👤 Rubin Thomas                              🟢 Internal
  ─────────────────────────────────────────────────────────────
  Role: Solution Architect

  ⭐ Skill Match Score:  72 / 100
  ██████████████░░░░░░░░░░  72%

  ─── Bandwidth ──────────────────────────────────────────────
  Available:  80%   ████████████████░░░░
  Occupied:   20%   ████░░░░░░░░░░░░░░░░   (Project Y)

  ─── Timeline Allocation ────────────────────────────────────
  Project Timeline:  Mar 01 – Mar 30
  Can join:          Mar 05  ⚠️ (available after Mar 05)
  Conflict:          Minor — overlap until Mar 04

  ─── Full Skill Set ─────────────────────────────────────────
  ✅ System Design & HLD
  ✅ Cloud Cost Optimization
  ✅ Microservices Design
  ⚠️  AWS Solutions Architecture (Partial)
  ⚠️  Kubernetes (Partial)
  ❌ ML/AI Architecture

  [ Assign to Project ]
  ─────────────────────────────────────────────────────────────

  (more candidates listed below in same format...)
```

---

#### External Tab Layout

```
[ Internal ]   [ External ● ]
─────────────────────────────────────────────────────────────────

  👤 Kiran Mehta                               🔵 External Partner
  ─────────────────────────────────────────────────────────────
  Role: Solution Architect
  Agency / Firm: CloudEdge Consultants

  ⭐ Skill Match Score:  91 / 100
  ██████████████████████░░  91%

  ─── Bandwidth ──────────────────────────────────────────────
  Available:  100%   ████████████████████
  Occupied:     0%   (No active project)

  ─── Timeline Allocation ────────────────────────────────────
  Project Timeline:  Mar 01 – Mar 30
  Can join:          Mar 01  ✅
  Conflict:          None

  ─── Full Skill Set ─────────────────────────────────────────
  ✅ AWS Solutions Architecture
  ✅ Microservices Design
  ✅ System Design & HLD
  ✅ ML/AI Architecture
  ✅ Kubernetes
  ✅ Cloud Cost Optimization

  [ Assign to Project ]
  ─────────────────────────────────────────────────────────────

  👤 Priya Nair                                🟡 Contract
  ─────────────────────────────────────────────────────────────
  Role: Solution Architect
  Contract Type: Fixed-term

  ⭐ Skill Match Score:  68 / 100
  █████████████░░░░░░░░░░░  68%

  ─── Bandwidth ──────────────────────────────────────────────
  Available:  50%   ██████████░░░░░░░░░░
  Occupied:   50%   ██████████░░░░░░░░░░   (Project Z)

  ─── Timeline Allocation ────────────────────────────────────
  Project Timeline:  Mar 01 – Mar 30
  Can join:          Mar 10  ⚠️
  Conflict:          Overlap with Project Z until Mar 09

  ─── Full Skill Set ─────────────────────────────────────────
  ✅ System Design & HLD
  ✅ Microservices Design
  ⚠️  AWS Solutions Architecture (Partial)
  ❌ ML/AI Architecture
  ❌ Kubernetes

  [ Assign to Project ]
  ─────────────────────────────────────────────────────────────

  (more candidates listed below in same format...)
```

**Sorting rule (both tabs):** Cards sorted by Skill Match Score — highest score appears first.

---

#### Candidate Status Badges

| Badge | Meaning |
|---|---|
| 🟢 Internal | Full-time employee |
| 🟡 Contract | Fixed-term contractor |
| 🔵 External Partner | Agency / third-party resource |
| ⚪ TBD | Not yet determined |

---

### Resource Categories Reference

| Category | Examples |
|---|---|
| Junior Resources | Jr. Developer, Jr. QA |
| Senior Resources | Sr. Developer, Tech Lead |
| Architects | Solution Architect, Cloud Architect |
| Product/Tech Specialists | Product Manager, Business Analyst |
| External Partners | Freelancers, Agency Resources |

---

## Tab 4 — Governance

### Section A: Performance Metrics

```
┌───────────────────────────────────────────────────────────┐
│  📊 Governance Metrics                                    │
│                                                           │
│  Task Completion Rate       Target: > 90%                │
│  Current: ████████████████████░  88%   ⚠️ Below Target   │
│                                                           │
│  Client Satisfaction Rate   Target: 4.9+                 │
│  Current: ★★★★★  4.9   ✅ On Track                       │
│                                                           │
│  Team Productivity          Target: High                  │
│  Current: ████████████████░░░░  78%   🔶 Moderate        │
│                                                           │
│  Reporting Frequency:  [ Daily ● ]  [ Monthly ]          │
└───────────────────────────────────────────────────────────┘
```

---

### Section B: Tracking Sheets

**Three sub-tabs:**
```
[ Task Tracker ]  [ Review Tracker ]  [ Progress Dashboard ]
```

---

#### Task Tracker Sheet

| Task ID | Task Name | Assigned To | Status | Due Date | Completion % |
|---|---|---|---|---|---|
| T001 | Requirement Gathering | Balaji | ✅ Done | Mar 05 | 100% |
| T002 | Architecture Design | Rubin | 🔄 In Progress | Mar 12 | 60% |
| T003 | Backend Development | Dev Team | ⏳ Pending | Mar 25 | 0% |
| T004 | QA & Testing | QA Team | ⏳ Pending | Mar 28 | 0% |
| + | [ Add Task ] | | | | |

---

#### Review Tracker Sheet

| Review ID | Review Type | Reviewer | Review Date | Status | Notes |
|---|---|---|---|---|---|
| R001 | Design Review | Client POC | Mar 10 | ✅ Approved | Looks good |
| R002 | Code Review | Sr. Developer | Mar 18 | 🔄 Pending | — |
| + | [ Add Review ] | | | | |

---

#### Progress Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  📈 Project Health Overview                                  │
│                                                              │
│  Overall Completion:  ████████░░░░░░░░  52%                 │
│                                                              │
│  Timeline Health:     🟢 On Track                           │
│  Team Efficiency:     🟡 Moderate                           │
│  Task Backlog:        3 tasks pending                        │
│  Blockers:            1 open blocker                         │
│                                                              │
│  ─── Milestone Progress ────────────────────────────────── │
│  Milestone 1  ✅ Completed   Mar 01–07                      │
│  Milestone 2  🔄 In Progress Mar 08–14  (Day 4 of 7)        │
│  Milestone 3  ⏳ Upcoming    Mar 15–28                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Overall App Flow Summary

```
1. UPLOAD DOCUMENT
   └─→ AI parses: project name, client, scope, milestones, resources

2. SUMMARY & SCOPE TAB (Tab 1)
   └─→ Review & edit basic details + AI-generated summary

3. TIMELINE TAB (Tab 2)
   └─→ Define milestones (week/phase-wise)
   └─→ Set exact or relative dates
   └─→ Auto-progression logic applies

4. RESOURCE TAB (Tab 3)
   └─→ View required roles (hierarchy)
   └─→ Click role → see matched internal/external candidates
   └─→ Each candidate: Skill Score + Bandwidth + Timeline + Full Skills
   └─→ Assign to project

5. GOVERNANCE TAB (Tab 4)
   └─→ Set and track governance metrics
   └─→ Task Tracker sheet
   └─→ Review Tracker sheet
   └─→ Progress Dashboard
```

---

## State/Data Flow Between Tabs

```
Upload → Parse
    │
    ├──→ Tab 1: Project Name, Client, Scope, PDM
    │
    ├──→ Tab 2: Milestones extracted → editable timeline
    │
    ├──→ Tab 3: Required roles extracted → match against employee DB
    │               Timeline from Tab 2 used for availability check
    │
    └──→ Tab 4: Milestones from Tab 2 → task tracker pre-populated
                Resources from Tab 3 → assigned to tasks
```

---

*End of Flow Document*