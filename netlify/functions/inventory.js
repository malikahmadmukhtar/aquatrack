const { getDb } = require("./db");
const { verifyToken } = require("./auth");
const { ObjectId } = require("mongodb");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const DEFAULT_INVENTORY = {
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
  const params = event.queryStringParameters || {};
  const additionId = params.additionId || null;
  const overwrite = params.overwrite === "true";

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

    // ─── DELETE: Delete a past stock addition ───
    if (event.httpMethod === "DELETE") {
      if (!additionId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "additionId query parameter is required" }),
        };
      }

      const addition = await db.collection("inventory_additions").findOne({ _id: new ObjectId(additionId) });
      if (!addition) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Stock addition record not found" }),
        };
      }

      const current = await getCurrentInventory(db);
      const added = addition.added || {};

      // Subtract added amounts from current inventory
      const new_bottles_1_5L = (current.bottles_1_5L || 0) - (added.bottles_1_5L || 0);
      const new_bottles_0_5L = (current.bottles_0_5L || 0) - (added.bottles_0_5L || 0);
      const new_caps = (current.caps || 0) - (added.caps || 0);
      const new_shelling_1_5L_kg = Math.round(((current.shelling_1_5L_kg || 0) - (added.shelling_1_5L_kg || 0)) * 10000) / 10000;
      const new_shelling_0_5L_kg = Math.round(((current.shelling_0_5L_kg || 0) - (added.shelling_0_5L_kg || 0)) * 10000) / 10000;
      const new_calcium_kg = Math.round(((current.calcium_kg || 0) - (added.calcium_kg || 0)) * 10000) / 10000;
      const new_magnesium_kg = Math.round(((current.magnesium_kg || 0) - (added.magnesium_kg || 0)) * 10000) / 10000;
      const new_sodium_kg = Math.round(((current.sodium_kg || 0) - (added.sodium_kg || 0)) * 10000) / 10000;

      // Validate no negative inventory levels
      const invalid = [];
      if (new_bottles_1_5L < 0) invalid.push("1.5L Bottles");
      if (new_bottles_0_5L < 0) invalid.push("0.5L Bottles");
      if (new_caps < 0) invalid.push("Caps");
      if (new_shelling_1_5L_kg < 0) invalid.push("1.5L Shelling");
      if (new_shelling_0_5L_kg < 0) invalid.push("0.5L Shelling");
      if (new_calcium_kg < 0) invalid.push("Calcium");
      if (new_magnesium_kg < 0) invalid.push("Magnesium");
      if (new_sodium_kg < 0) invalid.push("Sodium");

      if (invalid.length > 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Cannot delete: inventory for [${invalid.join(", ")}] would drop below 0` }),
        };
      }

      const updatedInventory = {
        ...current,
        bottles_1_5L: new_bottles_1_5L,
        bottles_0_5L: new_bottles_0_5L,
        caps: new_caps,
        shelling_1_5L_kg: new_shelling_1_5L_kg,
        shelling_0_5L_kg: new_shelling_0_5L_kg,
        calcium_kg: new_calcium_kg,
        magnesium_kg: new_magnesium_kg,
        sodium_kg: new_sodium_kg,
        // Update baselines
        bottles_1_5L_at_last_addition: new_bottles_1_5L,
        bottles_0_5L_at_last_addition: new_bottles_0_5L,
        caps_at_last_addition: new_caps,
        shelling_1_5L_kg_at_last_addition: new_shelling_1_5L_kg,
        shelling_0_5L_kg_at_last_addition: new_shelling_0_5L_kg,
        calcium_kg_at_last_addition: new_calcium_kg,
        magnesium_kg_at_last_addition: new_magnesium_kg,
        sodium_kg_at_last_addition: new_sodium_kg,
        updated_at: new Date().toISOString()
      };

      await db.collection("inventory").replaceOne({ _id: "current" }, updatedInventory, { upsert: true });
      await db.collection("inventory_additions").deleteOne({ _id: new ObjectId(additionId) });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Stock addition deleted successfully", inventory: updatedInventory }),
      };
    }

    // ─── PUT: Add new stock, overwrite current stock, or edit past addition ───
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

      const raw_bottles_1_5L = body.bottles_1_5L;
      const raw_bottles_0_5L = body.bottles_0_5L;
      const raw_caps = body.caps;
      const raw_shelling_1_5L_kg = body.shelling_1_5L_kg;
      const raw_shelling_0_5L_kg = body.shelling_0_5L_kg;
      const raw_calcium_kg = body.calcium_kg;
      const raw_magnesium_kg = body.magnesium_kg;
      const raw_sodium_kg = body.sodium_kg;

      // Validate non-negative numbers
      const rawAdditions = {
        bottles_1_5L: raw_bottles_1_5L,
        bottles_0_5L: raw_bottles_0_5L,
        caps: raw_caps,
        shelling_1_5L_kg: raw_shelling_1_5L_kg,
        shelling_0_5L_kg: raw_shelling_0_5L_kg,
        calcium_kg: raw_calcium_kg,
        magnesium_kg: raw_magnesium_kg,
        sodium_kg: raw_sodium_kg,
      };
      for (const [key, val] of Object.entries(rawAdditions)) {
        if (val !== null && val !== undefined) {
          if (typeof val !== "number" || val < 0) {
            return {
              statusCode: 400,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: `${key} must be a non-negative number` }),
            };
          }
        }
      }

      const current = await getCurrentInventory(db);
      const now = new Date().toISOString();

      // CASE A: EDIT A PAST ADDITION
      if (additionId) {
        const addition = await db.collection("inventory_additions").findOne({ _id: new ObjectId(additionId) });
        if (!addition) {
          return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Stock addition record not found" }),
          };
        }

        const oldAdded = addition.added || {};

        const bottles_1_5L = (raw_bottles_1_5L !== null && raw_bottles_1_5L !== undefined) ? raw_bottles_1_5L : (oldAdded.bottles_1_5L || 0);
        const bottles_0_5L = (raw_bottles_0_5L !== null && raw_bottles_0_5L !== undefined) ? raw_bottles_0_5L : (oldAdded.bottles_0_5L || 0);
        const caps = (raw_caps !== null && raw_caps !== undefined) ? raw_caps : (oldAdded.caps || 0);
        const shelling_1_5L_kg = (raw_shelling_1_5L_kg !== null && raw_shelling_1_5L_kg !== undefined) ? raw_shelling_1_5L_kg : (oldAdded.shelling_1_5L_kg || 0);
        const shelling_0_5L_kg = (raw_shelling_0_5L_kg !== null && raw_shelling_0_5L_kg !== undefined) ? raw_shelling_0_5L_kg : (oldAdded.shelling_0_5L_kg || 0);
        const calcium_kg = (raw_calcium_kg !== null && raw_calcium_kg !== undefined) ? raw_calcium_kg : (oldAdded.calcium_kg || 0);
        const magnesium_kg = (raw_magnesium_kg !== null && raw_magnesium_kg !== undefined) ? raw_magnesium_kg : (oldAdded.magnesium_kg || 0);
        const sodium_kg = (raw_sodium_kg !== null && raw_sodium_kg !== undefined) ? raw_sodium_kg : (oldAdded.sodium_kg || 0);

        const additions = { bottles_1_5L, bottles_0_5L, caps, shelling_1_5L_kg, shelling_0_5L_kg, calcium_kg, magnesium_kg, sodium_kg };

        // Calculate new inventory totals (current - oldAdded + newAdded)
        const new_bottles_1_5L = (current.bottles_1_5L || 0) - (oldAdded.bottles_1_5L || 0) + bottles_1_5L;
        const new_bottles_0_5L = (current.bottles_0_5L || 0) - (oldAdded.bottles_0_5L || 0) + bottles_0_5L;
        const new_caps = (current.caps || 0) - (oldAdded.caps || 0) + caps;
        const new_shelling_1_5L_kg = Math.round(((current.shelling_1_5L_kg || 0) - (oldAdded.shelling_1_5L_kg || 0) + shelling_1_5L_kg) * 10000) / 10000;
        const new_shelling_0_5L_kg = Math.round(((current.shelling_0_5L_kg || 0) - (oldAdded.shelling_0_5L_kg || 0) + shelling_0_5L_kg) * 10000) / 10000;
        const new_calcium_kg = Math.round(((current.calcium_kg || 0) - (oldAdded.calcium_kg || 0) + calcium_kg) * 10000) / 10000;
        const new_magnesium_kg = Math.round(((current.magnesium_kg || 0) - (oldAdded.magnesium_kg || 0) + magnesium_kg) * 10000) / 10000;
        const new_sodium_kg = Math.round(((current.sodium_kg || 0) - (oldAdded.sodium_kg || 0) + sodium_kg) * 10000) / 10000;

        const invalid = [];
        if (new_bottles_1_5L < 0) invalid.push("1.5L Bottles");
        if (new_bottles_0_5L < 0) invalid.push("0.5L Bottles");
        if (new_caps < 0) invalid.push("Caps");
        if (new_shelling_1_5L_kg < 0) invalid.push("1.5L Shelling");
        if (new_shelling_0_5L_kg < 0) invalid.push("0.5L Shelling");
        if (new_calcium_kg < 0) invalid.push("Calcium");
        if (new_magnesium_kg < 0) invalid.push("Magnesium");
        if (new_sodium_kg < 0) invalid.push("Sodium");

        if (invalid.length > 0) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Cannot edit: inventory for [${invalid.join(", ")}] would drop below 0` }),
          };
        }

        const updatedInventory = {
          ...current,
          bottles_1_5L: new_bottles_1_5L,
          bottles_0_5L: new_bottles_0_5L,
          caps: new_caps,
          shelling_1_5L_kg: new_shelling_1_5L_kg,
          shelling_0_5L_kg: new_shelling_0_5L_kg,
          calcium_kg: new_calcium_kg,
          magnesium_kg: new_magnesium_kg,
          sodium_kg: new_sodium_kg,
          // Update baselines
          bottles_1_5L_at_last_addition: new_bottles_1_5L,
          bottles_0_5L_at_last_addition: new_bottles_0_5L,
          caps_at_last_addition: new_caps,
          shelling_1_5L_kg_at_last_addition: new_shelling_1_5L_kg,
          shelling_0_5L_kg_at_last_addition: new_shelling_0_5L_kg,
          calcium_kg_at_last_addition: new_calcium_kg,
          magnesium_kg_at_last_addition: new_magnesium_kg,
          sodium_kg_at_last_addition: new_sodium_kg,
          updated_at: now
        };

        const updatedRecord = {
          ...addition,
          added: additions,
          inventory_after: {
            bottles_1_5L: new_bottles_1_5L,
            bottles_0_5L: new_bottles_0_5L,
            caps: new_caps,
            shelling_1_5L_kg: new_shelling_1_5L_kg,
            shelling_0_5L_kg: new_shelling_0_5L_kg,
            calcium_kg: new_calcium_kg,
            magnesium_kg: new_magnesium_kg,
            sodium_kg: new_sodium_kg,
          },
          updated_at: now
        };

        await db.collection("inventory").replaceOne({ _id: "current" }, updatedInventory, { upsert: true });
        await db.collection("inventory_additions").replaceOne({ _id: new ObjectId(additionId) }, updatedRecord);

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Stock addition updated successfully", inventory: updatedInventory }),
        };
      }

      // CASE B: OVERWRITE CURRENT BASELINE STOCK DIRECTLY
      if (overwrite) {
        const final_bottles_1_5L = raw_bottles_1_5L !== null && raw_bottles_1_5L !== undefined ? raw_bottles_1_5L : (current.bottles_1_5L || 0);
        const final_bottles_0_5L = raw_bottles_0_5L !== null && raw_bottles_0_5L !== undefined ? raw_bottles_0_5L : (current.bottles_0_5L || 0);
        const final_caps = raw_caps !== null && raw_caps !== undefined ? raw_caps : (current.caps || 0);
        const final_shelling_1_5L_kg = raw_shelling_1_5L_kg !== null && raw_shelling_1_5L_kg !== undefined ? raw_shelling_1_5L_kg : (current.shelling_1_5L_kg || 0);
        const final_shelling_0_5L_kg = raw_shelling_0_5L_kg !== null && raw_shelling_0_5L_kg !== undefined ? raw_shelling_0_5L_kg : (current.shelling_0_5L_kg || 0);
        const final_calcium_kg = raw_calcium_kg !== null && raw_calcium_kg !== undefined ? raw_calcium_kg : (current.calcium_kg || 0);
        const final_magnesium_kg = raw_magnesium_kg !== null && raw_magnesium_kg !== undefined ? raw_magnesium_kg : (current.magnesium_kg || 0);
        const final_sodium_kg = raw_sodium_kg !== null && raw_sodium_kg !== undefined ? raw_sodium_kg : (current.sodium_kg || 0);

        const updatedInventory = {
          _id: "current",
          bottles_1_5L: final_bottles_1_5L,
          bottles_0_5L: final_bottles_0_5L,
          caps: final_caps,
          shelling_1_5L_kg: final_shelling_1_5L_kg,
          shelling_0_5L_kg: final_shelling_0_5L_kg,
          calcium_kg: final_calcium_kg,
          magnesium_kg: final_magnesium_kg,
          sodium_kg: final_sodium_kg,
          // Set baselines to these values directly
          bottles_1_5L_at_last_addition: final_bottles_1_5L,
          bottles_0_5L_at_last_addition: final_bottles_0_5L,
          caps_at_last_addition: final_caps,
          shelling_1_5L_kg_at_last_addition: final_shelling_1_5L_kg,
          shelling_0_5L_kg_at_last_addition: final_shelling_0_5L_kg,
          calcium_kg_at_last_addition: final_calcium_kg,
          magnesium_kg_at_last_addition: final_magnesium_kg,
          sodium_kg_at_last_addition: final_sodium_kg,
          last_inventory_addition_date: now,
          low_inventory_alert: false,
          alert_metrics: [],
        };

        await db.collection("inventory").replaceOne({ _id: "current" }, updatedInventory, { upsert: true });

        // Save record documenting baseline overwrite
        const additionRecord = {
          date: now.split("T")[0],
          added: {
            bottles_1_5L: raw_bottles_1_5L,
            bottles_0_5L: raw_bottles_0_5L,
            caps: raw_caps,
            shelling_1_5L_kg: raw_shelling_1_5L_kg,
            shelling_0_5L_kg: raw_shelling_0_5L_kg,
            calcium_kg: raw_calcium_kg,
            magnesium_kg: raw_magnesium_kg,
            sodium_kg: raw_sodium_kg,
          },
          is_overwrite: true,
          inventory_before: {
            bottles_1_5L: current.bottles_1_5L || 0,
            bottles_0_5L: current.bottles_0_5L || 0,
            caps: current.caps || 0,
            shelling_1_5L_kg: current.shelling_1_5L_kg || 0,
            shelling_0_5L_kg: current.shelling_0_5L_kg || 0,
            calcium_kg: current.calcium_kg || 0,
            magnesium_kg: current.magnesium_kg || 0,
            sodium_kg: current.sodium_kg || 0,
          },
          inventory_after: {
            bottles_1_5L: final_bottles_1_5L,
            bottles_0_5L: final_bottles_0_5L,
            caps: final_caps,
            shelling_1_5L_kg: final_shelling_1_5L_kg,
            shelling_0_5L_kg: final_shelling_0_5L_kg,
            calcium_kg: final_calcium_kg,
            magnesium_kg: final_magnesium_kg,
            sodium_kg: final_sodium_kg,
          },
          created_at: now,
        };

        await db.collection("inventory_additions").insertOne(additionRecord);

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Inventory baseline corrected successfully", inventory: updatedInventory }),
        };
      }

      // CASE C: ADD STOCK TRANSACTION (STANDARD ADDITION)
      const bottles_1_5L = (raw_bottles_1_5L !== null && raw_bottles_1_5L !== undefined) ? raw_bottles_1_5L : 0;
      const bottles_0_5L = (raw_bottles_0_5L !== null && raw_bottles_0_5L !== undefined) ? raw_bottles_0_5L : 0;
      const caps = (raw_caps !== null && raw_caps !== undefined) ? raw_caps : 0;
      const shelling_1_5L_kg = (raw_shelling_1_5L_kg !== null && raw_shelling_1_5L_kg !== undefined) ? raw_shelling_1_5L_kg : 0;
      const shelling_0_5L_kg = (raw_shelling_0_5L_kg !== null && raw_shelling_0_5L_kg !== undefined) ? raw_shelling_0_5L_kg : 0;
      const calcium_kg = (raw_calcium_kg !== null && raw_calcium_kg !== undefined) ? raw_calcium_kg : 0;
      const magnesium_kg = (raw_magnesium_kg !== null && raw_magnesium_kg !== undefined) ? raw_magnesium_kg : 0;
      const sodium_kg = (raw_sodium_kg !== null && raw_sodium_kg !== undefined) ? raw_sodium_kg : 0;

      const additions = { bottles_1_5L, bottles_0_5L, caps, shelling_1_5L_kg, shelling_0_5L_kg, calcium_kg, magnesium_kg, sodium_kg };

      const inventory_before = {
        bottles_1_5L: current.bottles_1_5L || 0,
        bottles_0_5L: current.bottles_0_5L || 0,
        caps: current.caps || 0,
        shelling_1_5L_kg: current.shelling_1_5L_kg || 0,
        shelling_0_5L_kg: current.shelling_0_5L_kg || 0,
        calcium_kg: current.calcium_kg || 0,
        magnesium_kg: current.magnesium_kg || 0,
        sodium_kg: current.sodium_kg || 0,
      };

      const new_bottles_1_5L = (current.bottles_1_5L || 0) + bottles_1_5L;
      const new_bottles_0_5L = (current.bottles_0_5L || 0) + bottles_0_5L;
      const new_caps = (current.caps || 0) + caps;
      const new_shelling_1_5L_kg = Math.round(((current.shelling_1_5L_kg || 0) + shelling_1_5L_kg) * 10000) / 10000;
      const new_shelling_0_5L_kg = Math.round(((current.shelling_0_5L_kg || 0) + shelling_0_5L_kg) * 10000) / 10000;
      const new_calcium_kg = Math.round(((current.calcium_kg || 0) + calcium_kg) * 10000) / 10000;
      const new_magnesium_kg = Math.round(((current.magnesium_kg || 0) + magnesium_kg) * 10000) / 10000;
      const new_sodium_kg = Math.round(((current.sodium_kg || 0) + sodium_kg) * 10000) / 10000;

      const updatedInventory = {
        _id: "current",
        bottles_1_5L: new_bottles_1_5L,
        bottles_0_5L: new_bottles_0_5L,
        caps: new_caps,
        shelling_1_5L_kg: new_shelling_1_5L_kg,
        shelling_0_5L_kg: new_shelling_0_5L_kg,
        calcium_kg: new_calcium_kg,
        magnesium_kg: new_magnesium_kg,
        sodium_kg: new_sodium_kg,
        bottles_1_5L_at_last_addition: new_bottles_1_5L,
        bottles_0_5L_at_last_addition: new_bottles_0_5L,
        caps_at_last_addition: new_caps,
        shelling_1_5L_kg_at_last_addition: new_shelling_1_5L_kg,
        shelling_0_5L_kg_at_last_addition: new_shelling_0_5L_kg,
        calcium_kg_at_last_addition: new_calcium_kg,
        magnesium_kg_at_last_addition: new_magnesium_kg,
        sodium_kg_at_last_addition: new_sodium_kg,
        last_inventory_addition_date: now,
        low_inventory_alert: false,
        alert_metrics: [],
      };

      await db.collection("inventory").replaceOne({ _id: "current" }, updatedInventory, { upsert: true });

      const inventory_after = {
        bottles_1_5L: new_bottles_1_5L,
        bottles_0_5L: new_bottles_0_5L,
        caps: new_caps,
        shelling_1_5L_kg: new_shelling_1_5L_kg,
        shelling_0_5L_kg: new_shelling_0_5L_kg,
        calcium_kg: new_calcium_kg,
        magnesium_kg: new_magnesium_kg,
        sodium_kg: new_sodium_kg,
      };

      const additionRecord = {
        date: now.split("T")[0],
        added: additions,
        inventory_before,
        inventory_after,
        created_at: now,
      };
      await db.collection("inventory_additions").insertOne(additionRecord);

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
