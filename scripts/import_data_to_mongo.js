import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "Data");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MongoDB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "delivery_tracker";

if (!MONGO_URI) {
  console.error("Missing Mongo URI. Set MONGODB_URI (or MONGO_URI / MongoDB_URI) in .env");
  process.exit(1);
}

const FILE_TO_COLLECTION = {
  "clients-export": "clients",
  "projects-export": "projects",
  "milestones-export": "milestones",
  "team_members-export": "team_members",
  "project_assignments-export": "project_assignments",
  "audit_log-export": "audit_log",
};

const NUMERIC_FIELDS = new Set([
  "completion_pct",
  "days_variance",
  "engagement_pct",
  "allocated_hours_per_week",
]);

const BOOLEAN_FIELDS = new Set(["blocker", "is_active"]);
const JSON_FIELDS = new Set(["changed_fields", "old_values", "new_values"]);

function parseDelimitedLine(line, delimiter = ";") {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function splitRows(text) {
  const rows = [];
  let row = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        row += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        row += ch;
      }
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (row.trim().length > 0) {
        rows.push(row);
      }
      row = "";
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      continue;
    }

    row += ch;
  }

  if (row.trim().length > 0) {
    rows.push(row);
  }

  return rows;
}

function coerceValue(field, raw) {
  if (raw === "") return null;

  if (BOOLEAN_FIELDS.has(field)) {
    if (raw.toLowerCase() === "true") return true;
    if (raw.toLowerCase() === "false") return false;
  }

  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  if (JSON_FIELDS.has(field)) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
}

function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = splitRows(text);
  if (rows.length === 0) return [];

  const headers = parseDelimitedLine(rows[0]).map((h) => h.trim());
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const values = parseDelimitedLine(rows[i]);
    if (values.length === 1 && values[0].trim() === "") continue;

    const obj = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      const value = values[j] ?? "";
      obj[key] = coerceValue(key, value);
    }

    if (!obj.id) {
      continue;
    }

    records.push(obj);
  }

  return records;
}

function getCollectionFromFile(filename) {
  const key = Object.keys(FILE_TO_COLLECTION).find((k) => filename.startsWith(k));
  return key ? FILE_TO_COLLECTION[key] : null;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data folder not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".csv"));

  if (files.length === 0) {
    console.error("No CSV files found in Data folder.");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const summary = [];

    for (const file of files) {
      const collectionName = getCollectionFromFile(file);
      if (!collectionName) {
        summary.push(`${file}: skipped (no collection mapping)`);
        continue;
      }

      const filePath = path.join(DATA_DIR, file);
      const records = parseCsvFile(filePath);
      const col = db.collection(collectionName);

      await col.deleteMany({});
      if (records.length > 0) {
        await col.insertMany(records, { ordered: false });
      }

      summary.push(`${file}: imported ${records.length} -> ${collectionName}`);
    }

    console.log("Import complete:");
    for (const line of summary) {
      console.log(`- ${line}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Import failed:");
  console.error(String(err?.stack || err));
  process.exit(1);
});
