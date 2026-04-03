import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.API_PORT || 4000);
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MongoDB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "delivery_tracker";

if (!MONGO_URI) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
});

try {
  await client.connect();
} catch (error) {
  const message = String(error?.message || error);
  console.error("Failed to connect to MongoDB.");
  console.error(message);

  if (MONGO_URI.startsWith("mongodb+srv://")) {
    console.error(
      "If you see DNS/SRV errors, your network DNS may block Atlas SRV lookups. Use Atlas 'Drivers > Node.js' and copy the standard connection string (mongodb://...) as MONGODB_URI, or use a network that allows SRV resolution."
    );
  }

  process.exit(1);
}

const db = client.db(DB_NAME);

const COLLECTIONS = new Set([
  "clients",
  "projects",
  "milestones",
  "team_members",
  "project_assignments",
  "audit_log",
  "project_updates",
]);

const ensureIndexes = async () => {
  const ids = [...COLLECTIONS];
  for (const table of ids) {
    await db.collection(table).createIndex({ id: 1 }, { unique: true, sparse: true });
  }

  // Natural-key duplicate protection for key relations.
  await db
    .collection("project_assignments")
    .createIndex({ project_id: 1, team_member_id: 1 }, { unique: true, sparse: true });
};

try {
  await ensureIndexes();
} catch (error) {
  console.error("Index initialization warning:");
  console.error(String(error?.message || error));
}

const withId = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: rest.id || String(_id),
  };
};

const normalizeTimestampsOnInsert = (table, doc) => {
  const now = new Date().toISOString();
  const next = {
    ...doc,
    id: doc.id || randomUUID(),
  };

  if (table === "clients") {
    next.created_at = next.created_at || now;
  }

  if (["projects", "milestones", "team_members"].includes(table)) {
    next.created_at = next.created_at || now;
    next.updated_at = next.updated_at || now;
  }

  if (["project_assignments", "project_updates"].includes(table)) {
    next.created_at = next.created_at || now;
  }

  if (table === "audit_log") {
    next.created_at = next.created_at || now;
    next.changed_by = next.changed_by || "system";
  }

  return next;
};

const validateTable = (req, res, next) => {
  const table = req.params.table;
  if (!COLLECTIONS.has(table)) {
    res.status(404).json({ error: `Unknown table: ${table}` });
    return;
  }
  next();
};

const buildFilter = (query) => {
  const filter = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (["orderBy", "ascending", "limit", "offset"].includes(key)) continue;
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    filter[key] = String(rawValue);
  }
  return filter;
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/:table", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const filter = buildFilter(req.query);

    const cursor = db.collection(table).find(filter);

    if (req.query.orderBy) {
      const dir = req.query.ascending === "false" ? -1 : 1;
      cursor.sort({ [String(req.query.orderBy)]: dir });
    }

    const limit = Number(req.query.limit);
    if (Number.isFinite(limit) && limit > 0) {
      cursor.limit(limit);
    }

    const offset = Number(req.query.offset);
    if (Number.isFinite(offset) && offset > 0) {
      cursor.skip(offset);
    }

    const docs = await cursor.toArray();
    res.json(docs.map(withId));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/:table/:id", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const id = String(req.params.id);
    const doc = await db.collection(table).findOne({ id });

    if (!doc) {
      res.status(404).json({ error: `${table} record not found` });
      return;
    }

    res.json(withId(doc));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/:table", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const input = req.body;
    if (!input || typeof input !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    if (Array.isArray(input)) {
      const docs = input.map((d) => normalizeTimestampsOnInsert(table, d));
      if (docs.length === 0) {
        res.json([]);
        return;
      }
      await db.collection(table).insertMany(docs);
      res.status(201).json(docs.map(withId));
      return;
    }

    const doc = normalizeTimestampsOnInsert(table, input);
    await db.collection(table).insertOne(doc);
    res.status(201).json(withId(doc));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.patch("/api/:table/:id", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const id = req.params.id;
    const changes = req.body;

    if (!changes || typeof changes !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    if (["projects", "milestones", "team_members"].includes(table)) {
      changes.updated_at = new Date().toISOString();
    }

    await db.collection(table).updateOne({ id }, { $set: changes });
    const updated = await db.collection(table).findOne({ id });
    res.json(withId(updated));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put("/api/:table/:id", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const id = req.params.id;
    const replacement = req.body;

    if (!replacement || typeof replacement !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    const existing = await db.collection(table).findOne({ id });
    if (!existing) {
      res.status(404).json({ error: `${table} record not found` });
      return;
    }

    const next = {
      ...existing,
      ...replacement,
      id,
    };

    if (["projects", "milestones", "team_members"].includes(table)) {
      next.updated_at = new Date().toISOString();
    }

    await db.collection(table).replaceOne({ id }, next);
    const updated = await db.collection(table).findOne({ id });
    res.json(withId(updated));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete("/api/:table/:id", validateTable, async (req, res) => {
  try {
    const table = req.params.table;
    const id = req.params.id;
    const existing = await db.collection(table).findOne({ id });
    await db.collection(table).deleteOne({ id });
    res.json({ ok: true, deleted: withId(existing) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Export app for Vercel serverless runtime.
export default app;

if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Mongo API listening on http://localhost:${PORT}`);
  });

  server.on("error", async (error) => {
    if (error?.code === "EADDRINUSE") {
      try {
        const existing = await fetch(`http://localhost:${PORT}/api/health`);
        if (existing.ok) {
          console.log(
            `Port ${PORT} is already in use by a healthy API instance. Reusing existing server.`
          );
          process.exit(0);
        }
      } catch {
        // fall through to hard error below
      }

      console.error(
        `Port ${PORT} is already in use by another process. Stop it or set API_PORT to a different port.`
      );
      process.exit(1);
    }

    console.error("Server failed to start.");
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
