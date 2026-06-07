const { MongoClient } = require("mongodb");

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      maxPoolSize: 3,
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db("inventory_app");
  return cachedDb;
}

module.exports = { getDb };
