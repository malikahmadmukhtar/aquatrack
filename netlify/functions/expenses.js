const { getDb } = require("./db");
const { verifyToken } = require("./auth");
const { ObjectId } = require("mongodb");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

const EXPENSE_CATEGORIES = [
  "bottles", "caps", "shells", "labels",
  "labour", "petrol", "shop_rent", "other",
];

function parseExpenseBody(body) {
  const expense = {};
  let total = 0;
  for (const cat of EXPENSE_CATEGORIES) {
    const val = body[cat] !== undefined ? body[cat] : 0;
    if (typeof val !== "number" || val < 0) {
      return { error: `${cat} must be a non-negative number` };
    }
    expense[cat] = val;
    total += val;
  }
  expense.total_expense = total;
  return { expense };
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
  const expenseId = params.id || null;

  try {
    // ─── GET ───
    if (event.httpMethod === "GET") {
      const type = params.type || null;

      // ─── GET: Paginated expense history ───
      if (type === "history") {
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 30, 1), 100);
        const offset = Math.max(parseInt(params.offset, 10) || 0, 0);
        const startDate = params.startDate || null;
        const endDate = params.endDate || null;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = startDate;
        if (endDate) dateFilter.$lte = endDate;
        const query = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

        const collection = db.collection("expenses");
        const [records, total] = await Promise.all([
          collection.find(query).sort({ date: -1 }).skip(offset).limit(limit).toArray(),
          collection.countDocuments(query),
        ]);

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ type: "history", records, total, limit, offset }),
        };
      }

      // ─── GET: Aggregated expense summaries with revenue & profit ───
      if (type === "summary") {
        const period = params.period || "daily";

        if (!["daily", "weekly", "monthly"].includes(period)) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Invalid period. Must be one of: daily, weekly, monthly" }),
          };
        }

        const now = new Date();
        let cutoffDate;

        if (period === "daily") {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          cutoffDate = d.toISOString().slice(0, 10);
        } else if (period === "weekly") {
          const d = new Date(now);
          d.setDate(d.getDate() - 84); // 12 weeks
          cutoffDate = d.toISOString().slice(0, 10);
        } else {
          // monthly — last 12 months
          const d = new Date(now);
          d.setMonth(d.getMonth() - 12);
          cutoffDate = d.toISOString().slice(0, 10);
        }

        const dateMatch = { $match: { date: { $gte: cutoffDate } } };

        // Build grouping _id and period_label based on period
        let expenseGroupId, expensePeriodLabel;
        let revenueGroupId, revenuePeriodLabel;

        if (period === "daily") {
          expenseGroupId = "$date";
          expensePeriodLabel = "$_id";
          revenueGroupId = "$date";
          revenuePeriodLabel = "$_id";
        } else if (period === "weekly") {
          // We need to convert date string to Date for $isoWeek
          expenseGroupId = {
            isoWeekYear: { $isoWeekYear: { $dateFromString: { dateString: "$date" } } },
            isoWeek: { $isoWeek: { $dateFromString: { dateString: "$date" } } },
          };
          expensePeriodLabel = {
            $concat: [
              { $toString: "$_id.isoWeekYear" },
              "-W",
              {
                $cond: {
                  if: { $lt: ["$_id.isoWeek", 10] },
                  then: { $concat: ["0", { $toString: "$_id.isoWeek" }] },
                  else: { $toString: "$_id.isoWeek" },
                },
              },
            ],
          };
          revenueGroupId = {
            isoWeekYear: { $isoWeekYear: { $dateFromString: { dateString: "$date" } } },
            isoWeek: { $isoWeek: { $dateFromString: { dateString: "$date" } } },
          };
          revenuePeriodLabel = {
            $concat: [
              { $toString: "$_id.isoWeekYear" },
              "-W",
              {
                $cond: {
                  if: { $lt: ["$_id.isoWeek", 10] },
                  then: { $concat: ["0", { $toString: "$_id.isoWeek" }] },
                  else: { $toString: "$_id.isoWeek" },
                },
              },
            ],
          };
        } else {
          // monthly
          expenseGroupId = {
            year: { $year: { $dateFromString: { dateString: "$date" } } },
            month: { $month: { $dateFromString: { dateString: "$date" } } },
          };
          expensePeriodLabel = {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: {
                  if: { $lt: ["$_id.month", 10] },
                  then: { $concat: ["0", { $toString: "$_id.month" }] },
                  else: { $toString: "$_id.month" },
                },
              },
            ],
          };
          revenueGroupId = {
            year: { $year: { $dateFromString: { dateString: "$date" } } },
            month: { $month: { $dateFromString: { dateString: "$date" } } },
          };
          revenuePeriodLabel = {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: {
                  if: { $lt: ["$_id.month", 10] },
                  then: { $concat: ["0", { $toString: "$_id.month" }] },
                  else: { $toString: "$_id.month" },
                },
              },
            ],
          };
        }

        // Expense aggregation pipeline
        const expensePipeline = [
          dateMatch,
          {
            $group: {
              _id: expenseGroupId,
              total_expense: { $sum: "$total_expense" },
              bottles: { $sum: "$bottles" },
              caps: { $sum: "$caps" },
              shells: { $sum: "$shells" },
              labels: { $sum: "$labels" },
              labour: { $sum: "$labour" },
              petrol: { $sum: "$petrol" },
              shop_rent: { $sum: "$shop_rent" },
              other: { $sum: "$other" },
            },
          },
          {
            $project: {
              _id: 0,
              period_label: expensePeriodLabel,
              total_expense: 1,
              breakdown: {
                bottles: "$bottles",
                caps: "$caps",
                shells: "$shells",
                labels: "$labels",
                labour: "$labour",
                petrol: "$petrol",
                shop_rent: "$shop_rent",
                other: "$other",
              },
            },
          },
          { $sort: { period_label: 1 } },
        ];

        // Revenue aggregation pipeline (from daily_logs)
        const revenuePipeline = [
          dateMatch,
          {
            $group: {
              _id: revenueGroupId,
              total_revenue: { $sum: "$calculated_revenue" },
            },
          },
          {
            $project: {
              _id: 0,
              period_label: revenuePeriodLabel,
              total_revenue: 1,
            },
          },
          { $sort: { period_label: 1 } },
        ];

        const [expenseData, revenueData] = await Promise.all([
          db.collection("expenses").aggregate(expensePipeline).toArray(),
          db.collection("daily_logs").aggregate(revenuePipeline).toArray(),
        ]);

        // Merge expense and revenue data by period_label
        const revenueMap = {};
        for (const r of revenueData) {
          revenueMap[r.period_label] = r.total_revenue;
        }

        // Also collect period labels from revenue that may not have expenses
        const expenseMap = {};
        for (const e of expenseData) {
          expenseMap[e.period_label] = e;
        }

        // Union all period labels
        const allLabels = new Set([
          ...Object.keys(expenseMap),
          ...Object.keys(revenueMap),
        ]);

        const data = Array.from(allLabels)
          .sort()
          .map((label) => {
            const exp = expenseMap[label] || {
              period_label: label,
              total_expense: 0,
              breakdown: {
                bottles: 0, caps: 0, shells: 0, labels: 0,
                labour: 0, petrol: 0, shop_rent: 0, other: 0,
              },
            };
            const totalRevenue = revenueMap[label] || 0;
            return {
              period_label: label,
              total_expense: exp.total_expense,
              total_revenue: totalRevenue,
              profit: totalRevenue - exp.total_expense,
              breakdown: exp.breakdown,
            };
          });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ type: "summary", period, data }),
        };
      }

      // ─── GET: Today's expense (default) ───
      const today = getTodayDate();
      const todayExpense = await db.collection("expenses").findOne({ date: today });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          date: today,
          expense: todayExpense || null,
        }),
      };
    }

    // ─── POST: Create or update today's expense ───
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

      const { expense, error } = parseExpenseBody(body || {});
      if (error) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error }),
        };
      }

      const today = getTodayDate();
      const now = new Date().toISOString();

      const result = await db.collection("expenses").findOneAndUpdate(
        { date: today },
        {
          $set: {
            ...expense,
            date: today,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      const savedExpense = result.value || result;

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: "Expense saved successfully",
          expense: savedExpense,
        }),
      };
    }

    // ─── PUT: Edit an existing expense ───
    if (event.httpMethod === "PUT") {
      if (!expenseId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Expense id query parameter is required" }),
        };
      }

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

      const { expense, error } = parseExpenseBody(body || {});
      if (error) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error }),
        };
      }

      const existing = await db.collection("expenses").findOne({ _id: new ObjectId(expenseId) });
      if (!existing) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Expense record not found" }),
        };
      }

      const updatedExpense = {
        ...existing,
        ...expense,
        updated_at: new Date().toISOString(),
      };

      await db.collection("expenses").replaceOne(
        { _id: new ObjectId(expenseId) },
        updatedExpense
      );

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: "Expense updated successfully",
          expense: updatedExpense,
        }),
      };
    }

    // ─── DELETE: Delete an expense ───
    if (event.httpMethod === "DELETE") {
      if (!expenseId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Expense id query parameter is required" }),
        };
      }

      const existing = await db.collection("expenses").findOne({ _id: new ObjectId(expenseId) });
      if (!existing) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Expense record not found" }),
        };
      }

      await db.collection("expenses").deleteOne({ _id: new ObjectId(expenseId) });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Expense deleted successfully" }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Expenses error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};

module.exports = { handler };
