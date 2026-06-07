const { getDb } = require("./db");
const { verifyToken } = require("./auth");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

async function getCurrentInventory(db) {
  const doc = await db.collection("inventory").findOne({ _id: "current" });
  if (!doc) {
    return {
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
  }
  return doc;
}

/**
 * Check if current value is at or below 25% of its at_last_addition baseline.
 */
function checkLowInventory(inventory) {
  const metrics = [
    { name: "bottles_1_5L", current: inventory.bottles_1_5L, baseline: inventory.bottles_1_5L_at_last_addition },
    { name: "bottles_0_5L", current: inventory.bottles_0_5L, baseline: inventory.bottles_0_5L_at_last_addition },
    { name: "caps", current: inventory.caps, baseline: inventory.caps_at_last_addition },
    { name: "shelling_1_5L_kg", current: inventory.shelling_1_5L_kg, baseline: inventory.shelling_1_5L_kg_at_last_addition },
    { name: "shelling_0_5L_kg", current: inventory.shelling_0_5L_kg, baseline: inventory.shelling_0_5L_kg_at_last_addition },
  ];

  const alertMetrics = [];
  for (const m of metrics) {
    // Only check if baseline > 0 to avoid false alerts on zero-baseline items
    if (m.baseline > 0 && m.current <= m.baseline * 0.25) {
      alertMetrics.push(m.name);
    }
  }

  return alertMetrics;
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
    // ─── GET: Return today's log ───
    if (event.httpMethod === "GET") {
      const today = getTodayDate();
      const todayLog = await db.collection("daily_logs").findOne({ date: today });
      const inventory = await getCurrentInventory(db);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          date: today,
          log: todayLog || null,
          inventory,
          low_inventory_alert: inventory.low_inventory_alert || false,
          alert_metrics: inventory.alert_metrics || [],
        }),
      };
    }

    // ─── POST: Log daily production & sales ───
    if (event.httpMethod === "POST") {
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
        pets_produced_1_5L = 0,
        pets_produced_0_5L = 0,
        pets_sold_1_5L = 0,
        pets_sold_0_5L = 0,
        minerals_used = null,
      } = body || {};

      // Validate numbers
      const numericFields = { pets_produced_1_5L, pets_produced_0_5L, pets_sold_1_5L, pets_sold_0_5L };
      for (const [key, val] of Object.entries(numericFields)) {
        if (typeof val !== "number" || val < 0) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `${key} must be a non-negative number` }),
          };
        }
      }

      // Calculate material usage from PRODUCED pets only
      const bottles_used_1_5L = pets_produced_1_5L * 6;
      const bottles_used_0_5L = pets_produced_0_5L * 12;
      const caps_used = bottles_used_1_5L + bottles_used_0_5L;
      const shelling_used_1_5L_kg = Math.round((pets_produced_1_5L / 38) * 10000) / 10000;
      const shelling_used_0_5L_kg = Math.round((pets_produced_0_5L / 44) * 10000) / 10000;

      // 1. Get current inventory
      const inventory = await getCurrentInventory(db);

      // 2. Snapshot before
      const inventory_before = {
        bottles_1_5L: inventory.bottles_1_5L,
        bottles_0_5L: inventory.bottles_0_5L,
        caps: inventory.caps,
        shelling_1_5L_kg: inventory.shelling_1_5L_kg,
        shelling_0_5L_kg: inventory.shelling_0_5L_kg,
      };

      // 3. Deduct materials (production-based)
      inventory.bottles_1_5L -= bottles_used_1_5L;
      inventory.bottles_0_5L -= bottles_used_0_5L;
      inventory.caps -= caps_used;
      inventory.shelling_1_5L_kg = Math.round((inventory.shelling_1_5L_kg - shelling_used_1_5L_kg) * 10000) / 10000;
      inventory.shelling_0_5L_kg = Math.round((inventory.shelling_0_5L_kg - shelling_used_0_5L_kg) * 10000) / 10000;

      // 4. Snapshot after
      const inventory_after = {
        bottles_1_5L: inventory.bottles_1_5L,
        bottles_0_5L: inventory.bottles_0_5L,
        caps: inventory.caps,
        shelling_1_5L_kg: inventory.shelling_1_5L_kg,
        shelling_0_5L_kg: inventory.shelling_0_5L_kg,
      };

      // 5. Check low inventory alerts (25% threshold)
      const alertMetrics = checkLowInventory(inventory);
      const hasAlert = alertMetrics.length > 0;
      inventory.low_inventory_alert = hasAlert;
      inventory.alert_metrics = alertMetrics;

      // 6. Update inventory document
      await db.collection("inventory").replaceOne(
        { _id: "current" },
        inventory,
        { upsert: true }
      );

      // 7. Build and save daily log
      const now = new Date().toISOString();
      const today = getTodayDate();

      // Normalize minerals_used
      const normalizedMinerals = minerals_used
        ? {
            calcium_kg: minerals_used.calcium_kg || 0,
            magnesium_kg: minerals_used.magnesium_kg || 0,
            sodium_kg: minerals_used.sodium_kg || 0,
          }
        : null;

      const dailyLog = {
        date: today,
        pets_produced_1_5L,
        pets_produced_0_5L,
        pets_sold_1_5L,
        pets_sold_0_5L,
        bottles_used_1_5L,
        bottles_used_0_5L,
        caps_used,
        shelling_used_1_5L_kg,
        shelling_used_0_5L_kg,
        minerals_used: normalizedMinerals,
        inventory_snapshot: {
          before: inventory_before,
          after: inventory_after,
        },
        created_at: now,
      };

      await db.collection("daily_logs").insertOne(dailyLog);

      // 8. Save mineral log if minerals_used has values
      if (
        normalizedMinerals &&
        (normalizedMinerals.calcium_kg > 0 ||
          normalizedMinerals.magnesium_kg > 0 ||
          normalizedMinerals.sodium_kg > 0)
      ) {
        await db.collection("mineral_logs").insertOne({
          date: today,
          calcium_kg: normalizedMinerals.calcium_kg,
          magnesium_kg: normalizedMinerals.magnesium_kg,
          sodium_kg: normalizedMinerals.sodium_kg,
          created_at: now,
        });
      }

      // 9. Return result
      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: "Daily log recorded successfully",
          daily_log: dailyLog,
          inventory,
          low_inventory_alert: hasAlert,
          alert_metrics: alertMetrics,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Daily log error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};

module.exports = { handler };
