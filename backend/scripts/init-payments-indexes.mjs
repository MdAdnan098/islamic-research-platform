import { readFileSync, existsSync } from "node:fs";
import { MongoClient } from "mongodb";

const path = new URL("../.dev.vars", import.meta.url);
if (!existsSync(path)) {
  console.error("backend/.dev.vars not found");
  process.exit(1);
}

const vars = {};
for (const line of readFileSync(path, "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i !== -1) vars[s.slice(0, i).trim()] = s.slice(i + 1).trim();
}

const uri = process.env.MONGODB_URI || vars.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || vars.MONGODB_DB_NAME;

if (!uri || dbName !== "islamic-research") {
  console.error("Stopped: missing URI or database is not the expected primary database.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const db = client.db("islamic-research");
  const payments = db.collection("payments");

  await payments.createIndex({ orderId: 1 }, { unique: true });
  await payments.createIndex(
    { paymentId: 1 },
    { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } }
  );
  await payments.createIndex({ courseId: 1, status: 1 });
  await payments.createIndex({ createdAt: -1 });

  console.log("SUCCESS: payments indexes initialized in islamic-research.");
  console.log("Index names:", (await payments.indexes()).map(i => i.name).join(", "));
  console.log("Payment documents:", await payments.countDocuments());
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
