import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MongoDB_URI;
const dbName = process.env.MONGODB_DB_NAME || "delivery_tracker";

if (!uri) {
  console.error("Missing Mongo URI.");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    const duplicateChecks = [
      {
        name: "clients",
        pipeline: [
          { $group: { _id: { name: { $toLower: "$name" } }, c: { $sum: 1 } } },
          { $match: { c: { $gt: 1 } } },
        ],
      },
      {
        name: "projects",
        pipeline: [
          {
            $group: {
              _id: { client_id: "$client_id", name: { $toLower: "$name" } },
              c: { $sum: 1 },
            },
          },
          { $match: { c: { $gt: 1 } } },
        ],
      },
      {
        name: "milestones",
        pipeline: [
          {
            $group: {
              _id: {
                project_id: "$project_id",
                code: { $toLower: { $ifNull: ["$milestone_code", ""] } },
              },
              c: { $sum: 1 },
            },
          },
          { $match: { c: { $gt: 1 } } },
        ],
      },
      {
        name: "project_assignments",
        pipeline: [
          {
            $group: {
              _id: { project_id: "$project_id", team_member_id: "$team_member_id" },
              c: { $sum: 1 },
            },
          },
          { $match: { c: { $gt: 1 } } },
        ],
      },
    ];

    for (const check of duplicateChecks) {
      const dupes = await db.collection(check.name).aggregate(check.pipeline).toArray();
      console.log(`${check.name}_dupes=${dupes.length}`);
    }

    const tables = [
      "clients",
      "projects",
      "milestones",
      "team_members",
      "project_assignments",
      "audit_log",
    ];
    for (const t of tables) {
      const count = await db.collection(t).countDocuments();
      console.log(`${t}_count=${count}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
