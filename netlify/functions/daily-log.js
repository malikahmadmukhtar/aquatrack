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
      calcium_kg: 0,
      magnesium_kg: 0,
      sodium_kg: 0,
      bottles_1_5L_at_last_addition: 0,
      bottles_0_5L_at_last_addition: 0,
      caps_at_last_addition: 0,
      shelling_1_5L_kg_at_last_addition: 0,
      shelling_0_5L_kg_at_last_addition: 0,
      calcium_kg_at_last_addition: 0,
      magnesium_kg_at_last_addition: 0,
      sodium_kg_at_last_addition: 0,
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
    { name: "calcium_kg", current: inventory.calcium_kg, baseline: inventory.calcium_kg_at_last_addition },
    { name: "magnesium_kg", current: inventory.magnesium_kg, baseline: inventory.magnesium_kg_at_last_addition },
    { name: "sodium_kg", current: inventory.sodium_kg, baseline: inventory.sodium_kg_at_last_addition },
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

      // Extract minerals
      const calcium_used = minerals_used ? (Number(minerals_used.calcium_kg) || 0) : 0;
      const magnesium_used = minerals_used ? (Number(minerals_used.magnesium_kg) || 0) : 0;
      const sodium_used = minerals_used ? (Number(minerals_used.sodium_kg) || 0) : 0;

      // 1. Get current inventory
      const inventory = await getCurrentInventory(db);

      // Enforce stock availability validation
      const insufficient = [];
      if ((inventory.bottles_1_5L || 0) < bottles_used_1_5L) insufficient.push(`1.5L Bottles (Required: ${bottles_used_1_5L}, Available: ${inventory.bottles_1_5L || 0})`);
      if ((inventory.bottles_0_5L || 0) < bottles_used_0_5L) insufficient.push(`0.5L Bottles (Required: ${bottles_used_0_5L}, Available: ${inventory.bottles_0_5L || 0})`);
      if ((inventory.caps || 0) < caps_used) insufficient.push(`Caps (Required: ${caps_used}, Available: ${inventory.caps || 0})`);
      if ((inventory.shelling_1_5L_kg || 0) < shelling_used_1_5L_kg) insufficient.push(`1.5L Shelling (Required: ${shelling_used_1_5L_kg} kg, Available: ${inventory.shelling_1_5L_kg || 0} kg)`);
      if ((inventory.shelling_0_5L_kg || 0) < shelling_used_0_5L_kg) insufficient.push(`0.5L Shelling (Required: ${shelling_used_0_5L_kg} kg, Available: ${inventory.shelling_0_5L_kg || 0} kg)`);
      if ((inventory.calcium_kg || 0) < calcium_used) insufficient.push(`Calcium (Required: ${calcium_used} kg, Available: ${inventory.calcium_kg || 0} kg)`);
      if ((inventory.magnesium_kg || 0) < magnesium_used) insufficient.push(`Magnesium (Required: ${magnesium_used} kg, Available: ${inventory.magnesium_kg || 0} kg)`);
      if ((inventory.sodium_kg || 0) < sodium_used) insufficient.push(`Sodium (Required: ${sodium_used} kg, Available: ${inventory.sodium_kg || 0} kg)`);

      if (insufficient.length > 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Insufficient inventory for: ${insufficient.join(", ")}` }),
        };
      }

      // 2. Snapshot before
      const inventory_before = {
        bottles_1_5L: inventory.bottles_1_5L || 0,
        bottles_0_5L: inventory.bottles_0_5L || 0,
        caps: inventory.caps || 0,
        shelling_1_5L_kg: inventory.shelling_1_5L_kg || 0,
        shelling_0_5L_kg: inventory.shelling_0_5L_kg || 0,
        calcium_kg: inventory.calcium_kg || 0,
        magnesium_kg: inventory.magnesium_kg || 0,
        sodium_kg: inventory.sodium_kg || 0,
      };

      // 3. Deduct materials (production-based)
      inventory.bottles_1_5L = (inventory.bottles_1_5L || 0) - bottles_used_1_5L;
      inventory.bottles_0_5L = (inventory.bottles_0_5L || 0) - bottles_used_0_5L;
      inventory.caps = (inventory.caps || 0) - caps_used;
      inventory.shelling_1_5L_kg = Math.round(((inventory.shelling_1_5L_kg || 0) - shelling_used_1_5L_kg) * 10000) / 10000;
      inventory.shelling_0_5L_kg = Math.round(((inventory.shelling_0_5L_kg || 0) - shelling_used_0_5L_kg) * 10000) / 10000;
      inventory.calcium_kg = Math.round(((inventory.calcium_kg || 0) - calcium_used) * 10000) / 10000;
      inventory.magnesium_kg = Math.round(((inventory.magnesium_kg || 0) - magnesium_used) * 10000) / 10000;
      inventory.sodium_kg = Math.round(((inventory.sodium_kg || 0) - sodium_used) * 10000) / 10000;

      // 4. Snapshot after
      const inventory_after = {
        bottles_1_5L: inventory.bottles_1_5L,
        bottles_0_5L: inventory.bottles_0_5L,
        caps: inventory.caps,
        shelling_1_5L_kg: inventory.shelling_1_5L_kg,
        shelling_0_5L_kg: inventory.shelling_0_5L_kg,
        calcium_kg: inventory.calcium_kg,
        magnesium_kg: inventory.magnesium_kg,
        sodium_kg: inventory.sodium_kg,
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
      const normalizedMinerals = {
        calcium_kg: calcium_used,
        magnesium_kg: magnesium_used,
        sodium_kg: sodium_used,
      };

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
      if (calcium_used > 0 || magnesium_used > 0 || sodium_used > 0) {
        await db.collection("mineral_logs").insertOne({
          date: today,
          calcium_kg: calcium_used,
          magnesium_kg: magnesium_used,
          sodium_kg: sodium_used,
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
