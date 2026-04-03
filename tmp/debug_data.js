import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function run() {
  const uri = process.env.MongoDB_URI;
  if (!uri) throw new Error("No MongoDB_URI found in .env");

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('delivery_tracker'); // DB name from server/index.js
    
    console.log("--- Projects Matching 'Gate Test' ---");
    const projects = await db.collection('projects').find({ name: /Gate Test/i }).toArray();
    console.log(JSON.stringify(projects, null, 2));

    if (projects.length > 0) {
      console.log("--- Milestones for these projects ---");
      const milestones = await db.collection('milestones').find({ project_id: { $in: projects.map(p => p.id) } }).toArray();
      console.log(JSON.stringify(milestones, null, 2));
    } else {
       console.log("No projects found matching 'Gate Test'");
    }

  } catch (err) {
    console.error("Error connecting to Mongo:", err);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
