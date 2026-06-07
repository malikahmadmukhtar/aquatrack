const { getDb } = require("./db");
const { verifyToken } = require("./auth");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

const DEFAULT_INVENTORY = {
  _id: "current",
  bottles_1_5L: 0,
  bottles_0_5L: 0,
  caps: 0,
  shelling_1_5L_kg: 0,
  shelling_0_5L_kg: 0,
  bottles_1_5L_at_last_addition: 0,
  bottles_0_5L_at_last_addition: 0,
  caps_at_last_addition: 0,
  shelling_1_5L_kg_at_last_addition: 0,
  shelling_0_5L_kg_at_last_addition: 0,
  last_inventory_addition_date: null,
  low_inventory_alert: false,
  alert_metrics: [],
};

async function getCurrentInventory(db) {
  const doc = await db.collection("inventory").findOne({ _id: "current" });
  return doc || { ...DEFAULT_INVENTORY };
}

const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    verifyToken(event);
  } catch (err) {
    return {
      statusCode: err.statusCode || 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }

  const db = await getDb();

  try {
    // ─── GET: Return current inventory ───
    if (event.httpMethod === "GET") {
      const inventory = await getCurrentInventory(db);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ inventory }),
      };
    }

    // ─── PUT: Add new stock ───
    if (event.httpMethod === "PUT") {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Invalid JSON body" }),
        };
      }

      const {
        bottles_1_5L = 0,
        bottles_0_5L = 0,
        caps = 0,
        shelling_1_5L_kg = 0,
        shelling_0_5L_kg = 0,
      } = body || {};

      // Validate all values are numbers
      const additions = { bottles_1_5L, bottles_0_5L, caps, shelling_1_5L_kg, shelling_0_5L_kg };
      for (const [key, val] of Object.entries(additions)) {
        if (typeof val !== "number" || val < 0) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `${key} must be a non-negative number` }),
          };
        }
      }

      // 1. Get current inventory
      const current = await getCurrentInventory(db);

      // 2. Snapshot before
      const inventory_before = {
        bottles_1_5L: current.bottles_1_5L,
        bottles_0_5L: current.bottles_0_5L,
        caps: current.caps,
        shelling_1_5L_kg: current.shelling_1_5L_kg,
        shelling_0_5L_kg: current.shelling_0_5L_kg,
      };

      // 3. Add quantities
      const new_bottles_1_5L = current.bottles_1_5L + bottles_1_5L;
      const new_bottles_0_5L = current.bottles_0_5L + bottles_0_5L;
      const new_caps = current.caps + caps;
      const new_shelling_1_5L_kg = Math.round((current.shelling_1_5L_kg + shelling_1_5L_kg) * 10000) / 10000;
      const new_shelling_0_5L_kg = Math.round((current.shelling_0_5L_kg + shelling_0_5L_kg) * 10000) / 10000;

      const now = new Date().toISOString();

      // 4-7. Build updated inventory document
      const updatedInventory = {
        _id: "current",
        bottles_1_5L: new_bottles_1_5L,
        bottles_0_5L: new_bottles_0_5L,
        caps: new_caps,
        shelling_1_5L_kg: new_shelling_1_5L_kg,
        shelling_0_5L_kg: new_shelling_0_5L_kg,
        // Reset baselines to new totals
        bottles_1_5L_at_last_addition: new_bottles_1_5L,
        bottles_0_5L_at_last_addition: new_bottles_0_5L,
        caps_at_last_addition: new_caps,
        shelling_1_5L_kg_at_last_addition: new_shelling_1_5L_kg,
        shelling_0_5L_kg_at_last_addition: new_shelling_0_5L_kg,
        last_inventory_addition_date: now,
        low_inventory_alert: false,
        alert_metrics: [],
      };

      // Upsert inventory
      await db.collection("inventory").replaceOne(
        { _id: "current" },
        updatedInventory,
        { upsert: true }
      );

      // Snapshot after
      const inventory_after = {
        bottles_1_5L: new_bottles_1_5L,
        bottles_0_5L: new_bottles_0_5L,
        caps: new_caps,
        shelling_1_5L_kg: new_shelling_1_5L_kg,
        shelling_0_5L_kg: new_shelling_0_5L_kg,
      };

      // 8. Save inventory_additions record
      const additionRecord = {
        date: now.split("T")[0],
        added: additions,
        inventory_before,
        inventory_after,
        created_at: now,
      };
      await db.collection("inventory_additions").insertOne(additionRecord);

      // 9. Return updated inventory
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: "Inventory updated successfully",
          inventory: updatedInventory,
          addition: additionRecord,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Inventory error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};

module.exports = { handler };
