import jwt from "jsonwebtoken";
import prisma from "../utils/db.js";

async function resolveActiveUser(decoded) {
  const userId = parseInt(decoded?.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { user_id: userId },
    select: { user_id: true, role: true, username: true, deleted_at: true },
  });
  if (!user || user.deleted_at) return null;

  return {
    ...decoded,
    userId: user.user_id,
    role: user.role,
    username: user.username,
  };
}

export const authenticate = async (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/, "");

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }

  try {
    const activeUser = await resolveActiveUser(decoded);
    if (!activeUser) {
      return res.status(401).json({ message: "Unauthorized: Account is inactive or deleted" });
    }
    req.user = activeUser;
    next();
  } catch (error) {
    console.error("authenticate error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Attaches req.user if a valid JWT cookie is present and the account is active,
// but continues without error otherwise — used on routes shared by staff and guests.
export const authenticateOptional = async (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next();
  }

  try {
    const activeUser = await resolveActiveUser(decoded);
    if (activeUser) req.user = activeUser;
  } catch {
    // Ignore optional lookup error; downstream guard handles missing user
  }
  next();
};