const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("./db");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

/**
 * Verify JWT from Authorization header.
 * Returns decoded payload on success, throws on failure.
 */
function verifyToken(event) {
  const authHeader =
    event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("Missing or invalid Authorization header");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    const err = new Error("Token not provided");
    err.statusCode = 401;
    throw err;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (e) {
    const err = new Error("Invalid or expired token");
    err.statusCode = 401;
    throw err;
  }
}

const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const db = await getDb();
    const usersCol = db.collection("users");

    // Auto-seed admin user if no users exist
    const userCount = await usersCol.countDocuments();
    if (userCount === 0) {
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminUsername || !adminPassword) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: "ADMIN_USERNAME and ADMIN_PASSWORD env vars are required for initial setup",
          }),
        };
      }
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await usersCol.insertOne({
        username: adminUsername,
        password: hashedPassword,
        created_at: new Date().toISOString(),
      });
    }

    // Parse credentials from request body
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

    const { username, password } = body || {};
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Username and password are required" }),
      };
    }

    // Validate credentials
    const user = await usersCol.findOne({ username });
    if (!user) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    // Issue JWT
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Authentication successful",
        token,
        username: user.username,
      }),
    };
  } catch (error) {
    console.error("Auth error:", error);
    return {
      statusCode: error.statusCode || 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};

module.exports = { handler, verifyToken };
