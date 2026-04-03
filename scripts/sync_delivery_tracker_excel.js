import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MongoDB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "delivery_tracker";

if (!MONGO_URI) {
  console.error("Missing Mongo URI. Set MONGODB_URI (or MONGO_URI / MongoDB_URI) in .env");
  process.exit(1);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isBlank(value) {
  const s = String(value ?? "").trim();
  return s === "" || s === "-" || s === "—" || normalizeText(s) === "na" || normalizeText(s) === "n/a";
}

function toNullableString(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

function toNullableNumber(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function excelDateToISO(value) {
  if (isBlank(value)) return null;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const s = String(value).trim();
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  return null;
}

function findDeliveryTrackerWorkbook(rootDir) {
  const candidates = fs
    .readdirSync(rootDir)
    .filter((f) => /delivery\s*tracker/i.test(f) && /\.xlsx$/i.test(f));

  if (candidates.length === 0) return null;
  candidates.sort();
  return path.join(rootDir, candidates[0]);
}

function splitNames(value) {
  if (isBlank(value)) return [];
  return String(value)
    .split(/,|&|\band\b|\//gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && normalizeText(s) !== "na");
}

function findBestMemberMatch(name, members) {
  const target = normalizeText(name);
  if (!target) return null;

  const exact = members.find((m) => normalizeText(m.name) === target);
  if (exact) return exact;

  const token = target.split(" ").filter(Boolean);
  if (token.length === 1) {
    const t = token[0];
    const partial = members.filter((m) => normalizeText(m.name).includes(t));
    if (partial.length === 1) return partial[0];
  }

  return null;
}

function mergeMissingFields(existing, incoming, fields) {
  const patch = {};

  for (const field of fields) {
    const hasExisting = !isBlank(existing[field]);
    const hasIncoming = !isBlank(incoming[field]);
    if (!hasExisting && hasIncoming) {
      patch[field] = incoming[field];
    }
  }

  return patch;
}

function parseWorkbook(workbookPath) {
  const wb = XLSX.readFile(workbookPath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rows.length < 4) {
    throw new Error("Workbook does not contain enough rows to parse.");
  }

  const parsed = [];
  let currentClient = null;
  let currentProject = null;

  for (let i = 3; i < rows.length; i += 1) {
    const r = rows[i] || [];

    const client = toNullableString(r[1]);
    const projectName = toNullableString(r[2]);
    const milestoneCode = toNullableString(r[11]);
    const milestoneDesc = toNullableString(r[13]);

    const isProjectRow = !!projectName;
    const hasMilestone = !!milestoneCode || !!milestoneDesc;
    if (!isProjectRow && !hasMilestone) {
      continue;
    }

    if (isProjectRow) {
      if (client) currentClient = client;
      currentProject = {
        client_name: currentClient,
        name: projectName,
        service_type: toNullableString(r[3]),
        revenue_model: toNullableString(r[4]),
        delivery_manager: toNullableString(r[5]),
        client_spoc: toNullableString(r[6]),
        project_type: toNullableString(r[7]),
        resource_aligned: toNullableString(r[8]),
        handled_by: toNullableString(r[9]),
      };
    }

    if (!currentProject) continue;

    if (hasMilestone) {
      parsed.push({
        project: { ...currentProject },
        milestone: {
          milestone_code: milestoneCode,
          description: milestoneDesc,
          planned_start: excelDateToISO(r[14]),
          planned_end: excelDateToISO(r[15]),
          actual_start: excelDateToISO(r[16]),
          actual_end_eta: excelDateToISO(r[17]),
          completion_pct: toNullableNumber(r[18]),
          deliverables: toNullableString(r[19]),
          milestone_flag: toNullableString(r[20])?.toLowerCase() || null,
          days_variance: toNullableNumber(r[21]),
          status: toNullableString(r[22]),
          blocker: (() => {
            const b = toNullableString(r[23]);
            if (!b) return null;
            const n = normalizeText(b);
            if (n === "y" || n === "yes" || n === "true") return true;
            if (n === "n" || n === "no" || n === "false") return false;
            return null;
          })(),
          blocker_owner: toNullableString(r[24]),
          remarks: toNullableString(r[25]),
          invoice_status: toNullableString(r[26]),
        },
      });
    }
  }

  return parsed;
}

async function main() {
  const workbookPath = findDeliveryTrackerWorkbook(ROOT);
  if (!workbookPath) {
    throw new Error("Could not find Delivery Tracker .xlsx file in project root.");
  }

  const parsedRows = parseWorkbook(workbookPath);
  if (parsedRows.length === 0) {
    throw new Error("No project/milestone rows could be parsed from workbook.");
  }

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await mongo.connect();

  try {
    const db = mongo.db(DB_NAME);
    const clientsCol = db.collection("clients");
    const projectsCol = db.collection("projects");
    const milestonesCol = db.collection("milestones");
    const membersCol = db.collection("team_members");
    const assignmentsCol = db.collection("project_assignments");

    const clients = await clientsCol.find({}).toArray();
    const projects = await projectsCol.find({}).toArray();
    const milestones = await milestonesCol.find({}).toArray();
    const members = await membersCol.find({}).toArray();
    const assignments = await assignmentsCol.find({}).toArray();

    const clientByName = new Map(clients.map((c) => [normalizeText(c.name), c]));
    const projectByClientAndName = new Map(
      projects.map((p) => [`${p.client_id}::${normalizeText(p.name)}`, p])
    );
    const milestoneByProjectAndCode = new Map(
      milestones.map((m) => [`${m.project_id}::${normalizeText(m.milestone_code || "")}`, m])
    );

    const assignmentKeys = new Set(
      assignments.map((a) => `${a.project_id}::${a.team_member_id}`)
    );

    let clientsInserted = 0;
    let projectsInserted = 0;
    let projectsPatched = 0;
    let milestonesInserted = 0;
    let milestonesPatched = 0;
    let membersInserted = 0;
    let assignmentsInserted = 0;
    let duplicateRowsSkipped = 0;

    const seenRowNaturalKeys = new Set();

    for (const row of parsedRows) {
      const clientName = row.project.client_name || "Unknown Client";
      const clientKey = normalizeText(clientName);
      let client = clientByName.get(clientKey);

      if (!client) {
        client = {
          id: randomUUID(),
          name: clientName,
          created_at: new Date().toISOString(),
        };
        await clientsCol.insertOne(client);
        clientByName.set(clientKey, client);
        clientsInserted += 1;
      }

      const projectNaturalName = normalizeText(row.project.name);
      if (!projectNaturalName) continue;

      const projectKey = `${client.id}::${projectNaturalName}`;
      let project = projectByClientAndName.get(projectKey);

      if (!project) {
        project = {
          id: randomUUID(),
          client_id: client.id,
          name: row.project.name,
          code: null,
          service_type: row.project.service_type,
          revenue_model: row.project.revenue_model,
          project_type: row.project.project_type,
          delivery_manager: row.project.delivery_manager,
          client_spoc: row.project.client_spoc,
          handled_by: row.project.handled_by,
          status: row.milestone.status || "In Progress",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await projectsCol.insertOne(project);
        projectByClientAndName.set(projectKey, project);
        projectsInserted += 1;
      } else {
        const projectPatch = mergeMissingFields(project, {
          service_type: row.project.service_type,
          revenue_model: row.project.revenue_model,
          project_type: row.project.project_type,
          delivery_manager: row.project.delivery_manager,
          client_spoc: row.project.client_spoc,
          handled_by: row.project.handled_by,
          status: row.milestone.status,
        }, [
          "service_type",
          "revenue_model",
          "project_type",
          "delivery_manager",
          "client_spoc",
          "handled_by",
          "status",
        ]);

        if (Object.keys(projectPatch).length > 0) {
          projectPatch.updated_at = new Date().toISOString();
          await projectsCol.updateOne({ id: project.id }, { $set: projectPatch });
          Object.assign(project, projectPatch);
          projectsPatched += 1;
        }
      }

      const milestoneCodeKey = normalizeText(row.milestone.milestone_code || "");
      const rowNaturalKey = `${project.id}::${milestoneCodeKey}::${normalizeText(row.milestone.description || "")}`;
      if (seenRowNaturalKeys.has(rowNaturalKey)) {
        duplicateRowsSkipped += 1;
        continue;
      }
      seenRowNaturalKeys.add(rowNaturalKey);

      const milestoneKey = `${project.id}::${milestoneCodeKey}`;
      let milestone = milestoneByProjectAndCode.get(milestoneKey);

      if (!milestone) {
        milestone = {
          id: randomUUID(),
          project_id: project.id,
          milestone_code: row.milestone.milestone_code,
          description: row.milestone.description,
          planned_start: row.milestone.planned_start,
          planned_end: row.milestone.planned_end,
          actual_start: row.milestone.actual_start,
          actual_end_eta: row.milestone.actual_end_eta,
          completion_pct: row.milestone.completion_pct,
          status: row.milestone.status,
          milestone_flag: row.milestone.milestone_flag,
          deliverables: row.milestone.deliverables,
          days_variance: row.milestone.days_variance,
          blocker: row.milestone.blocker,
          blocker_owner: row.milestone.blocker_owner,
          remarks: row.milestone.remarks,
          invoice_status: row.milestone.invoice_status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await milestonesCol.insertOne(milestone);
        milestoneByProjectAndCode.set(milestoneKey, milestone);
        milestonesInserted += 1;
      } else {
        const milestonePatch = mergeMissingFields(milestone, row.milestone, [
          "description",
          "planned_start",
          "planned_end",
          "actual_start",
          "actual_end_eta",
          "completion_pct",
          "status",
          "milestone_flag",
          "deliverables",
          "days_variance",
          "blocker",
          "blocker_owner",
          "remarks",
          "invoice_status",
        ]);

        if (Object.keys(milestonePatch).length > 0) {
          milestonePatch.updated_at = new Date().toISOString();
          await milestonesCol.updateOne({ id: milestone.id }, { $set: milestonePatch });
          Object.assign(milestone, milestonePatch);
          milestonesPatched += 1;
        }
      }

      const resourceNames = splitNames(row.project.resource_aligned);
      for (const personName of resourceNames) {
        let member = findBestMemberMatch(personName, members);
        if (!member) {
          const initials = personName
            .split(" ")
            .filter(Boolean)
            .map((s) => s[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "NA";

          member = {
            id: randomUUID(),
            name: personName,
            initials,
            role: "Unspecified",
            reports_to: null,
            member_type: null,
            engagement_pct: null,
            color_hex: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await membersCol.insertOne(member);
          members.push(member);
          membersInserted += 1;
        }

        const aKey = `${project.id}::${member.id}`;
        if (!assignmentKeys.has(aKey)) {
          const assignment = {
            id: randomUUID(),
            project_id: project.id,
            team_member_id: member.id,
            role_on_project: null,
            allocated_hours_per_week: null,
            start_date: null,
            end_date: null,
            created_at: new Date().toISOString(),
          };
          await assignmentsCol.insertOne(assignment);
          assignmentKeys.add(aKey);
          assignmentsInserted += 1;
        }
      }
    }

    console.log("Delivery Tracker sync complete:");
    console.log(`- clients inserted: ${clientsInserted}`);
    console.log(`- projects inserted: ${projectsInserted}`);
    console.log(`- projects patched (missing fields filled): ${projectsPatched}`);
    console.log(`- milestones inserted: ${milestonesInserted}`);
    console.log(`- milestones patched (missing fields filled): ${milestonesPatched}`);
    console.log(`- team members inserted: ${membersInserted}`);
    console.log(`- assignments inserted: ${assignmentsInserted}`);
    console.log(`- duplicate rows skipped (within workbook): ${duplicateRowsSkipped}`);
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error("Sync failed:");
  console.error(String(err?.stack || err));
  process.exit(1);
});
