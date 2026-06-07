const { getDb } = require("./db");
const { verifyToken } = require("./auth");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
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
    const params = event.queryStringParameters || {};
    const type = params.type || "daily";
    const limit = Math.min(Math.max(parseInt(params.limit, 10) || 30, 1), 100);
    const offset = Math.max(parseInt(params.offset, 10) || 0, 0);
    const startDate = params.startDate || null;
    const endDate = params.endDate || null;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = startDate;
    }
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    const query = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

    // ─── type=daily ───
    if (type === "daily") {
      const collection = db.collection("daily_logs");
      const [records, total] = await Promise.all([
        collection.find(query).sort({ date: -1 }).skip(offset).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ type, records, total, limit, offset }),
      };
    }

    // ─── type=additions ───
    if (type === "additions") {
      const collection = db.collection("inventory_additions");
      const [records, total] = await Promise.all([
        collection.find(query).sort({ date: -1 }).skip(offset).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ type, records, total, limit, offset }),
      };
    }

    // ─── type=minerals ───
    if (type === "minerals") {
      const collection = db.collection("mineral_logs");
      const [records, total] = await Promise.all([
        collection.find(query).sort({ date: -1 }).skip(offset).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ type, records, total, limit, offset }),
      };
    }

    // ─── type=summary ───
    if (type === "summary") {
      const collection = db.collection("daily_logs");

      const pipeline = [];

      // Apply date filter if provided
      if (Object.keys(dateFilter).length > 0) {
        pipeline.push({ $match: { date: dateFilter } });
      }

      pipeline.push({
        $group: {
          _id: null,
          total_pets_produced_1_5L: { $sum: "$pets_produced_1_5L" },
          total_pets_produced_0_5L: { $sum: "$pets_produced_0_5L" },
          total_pets_sold_1_5L: { $sum: "$pets_sold_1_5L" },
          total_pets_sold_0_5L: { $sum: "$pets_sold_0_5L" },
          total_bottles_used_1_5L: { $sum: "$bottles_used_1_5L" },
          total_bottles_used_0_5L: { $sum: "$bottles_used_0_5L" },
          total_caps_used: { $sum: "$caps_used" },
          total_shelling_used_1_5L_kg: { $sum: "$shelling_used_1_5L_kg" },
          total_shelling_used_0_5L_kg: { $sum: "$shelling_used_0_5L_kg" },
          total_days: { $sum: 1 },
        },
      });

      const result = await collection.aggregate(pipeline).toArray();
      const summary = result[0] || {
        total_pets_produced_1_5L: 0,
        total_pets_produced_0_5L: 0,
        total_pets_sold_1_5L: 0,
        total_pets_sold_0_5L: 0,
        total_bottles_used_1_5L: 0,
        total_bottles_used_0_5L: 0,
        total_caps_used: 0,
        total_shelling_used_1_5L_kg: 0,
        total_shelling_used_0_5L_kg: 0,
        total_days: 0,
      };

      // Remove the _id field from aggregation result
      delete summary._id;

      // Round shelling totals
      summary.total_shelling_used_1_5L_kg = Math.round(summary.total_shelling_used_1_5L_kg * 10000) / 10000;
      summary.total_shelling_used_0_5L_kg = Math.round(summary.total_shelling_used_0_5L_kg * 10000) / 10000;

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ type, summary }),
      };
    }

    // Unknown type
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Invalid type parameter. Must be one of: daily, additions, minerals, summary",
      }),
    };
  } catch (error) {
    console.error("History error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};

module.exports = { handler };
