const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('spectra');
    const result = await db.collection('employees').find({}).toArray();
    console.log(JSON.stringify(result, null, 2));
    await client.close();
}
run().catch(console.error);
