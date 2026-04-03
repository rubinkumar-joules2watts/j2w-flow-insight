import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const uri = process.env.MongoDB_URI;
  if (!uri) throw new Error("No MongoDB_URI found in .env");

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('delivery_tracker');
    
    // 1. Find correct and incorrect projects
    const correctProj = await db.collection('projects').findOne({ name: "Gate Test Maintenance" });
    const incorrectProj = await db.collection('projects').findOne({ name: "Gate Test Maintainance" });

    if (!correctProj || !incorrectProj) {
      console.log("Could not find both projects. Maybe one was already merged?");
      console.log("Correct:", !!correctProj, "Incorrect:", !!incorrectProj);
      return;
    }

    console.log(`Merging ${incorrectProj.id} into ${correctProj.id}...`);

    // 2. Update milestones
    const msUpdate = await db.collection('milestones').updateMany(
      { project_id: incorrectProj.id },
      { $set: { project_id: correctProj.id } }
    );
    console.log(`Updated ${msUpdate.modifiedCount} milestones.`);

    // 3. Update project assignments
    const asgnUpdate = await db.collection('project_assignments').updateMany(
      { project_id: incorrectProj.id },
      { $set: { project_id: correctProj.id } }
    );
    console.log(`Updated ${asgnUpdate.modifiedCount} assignments.`);

    // 4. Update project updates (timeline)
    const updUpdate = await db.collection('project_updates').updateMany(
      { project_id: incorrectProj.id },
      { $set: { project_id: correctProj.id } }
    );
    console.log(`Updated ${updUpdate.modifiedCount} timeline entries.`);

    // 5. Update project documents
    const docUpdate = await db.collection('project_documents').updateMany(
      { project_id: incorrectProj.id },
      { $set: { project_id: correctProj.id } }
    );
    console.log(`Updated ${docUpdate.modifiedCount} documents.`);

    // 6. Delete the incorrect project
    const delResult = await db.collection('projects').deleteOne({ id: incorrectProj.id });
    console.log(`Deleted incorrect project: ${delResult.deletedCount}`);

    // 7. Deduplicate milestones for the correct project
    // Find all milestones for the correct project
    const allMs = await db.collection('milestones').find({ project_id: correctProj.id }).toArray();
    const seen = new Set();
    for (const ms of allMs) {
       const key = `${ms.milestone_code}-${ms.description}`;
       if (seen.has(key)) {
          console.log(`Deleting duplicate milestone: ${key} (${ms.id})`);
          await db.collection('milestones').deleteOne({ id: ms.id });
       } else {
         seen.add(key);
       }
    }

  } catch (err) {
    console.error("Merge error:", err);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
