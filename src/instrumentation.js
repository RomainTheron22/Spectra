export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "spectra";
  if (!uri) return;

  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const configs = await db.collection("app_config").find({}).toArray();
    for (const item of configs) {
      if (item.key && item.value !== undefined && item.value !== null) {
        process.env[item.key] = String(item.value);
      }
    }
    await client.close();
    console.log(`[instrumentation] ${configs.length} config(s) chargée(s) depuis MongoDB app_config.`);
  } catch (err) {
    console.warn("[instrumentation] Impossible de charger app_config depuis MongoDB :", err.message);
  }
}
