import prisma from "../../utils/db.js";
import bcrypt from "bcrypt";

const STAFF_ROLES = new Set(["cashier", "barista", "kitchen"]);

const USER_PUBLIC_SELECT = {
  user_id: true,
  username: true,
  email: true,
  role: true,
  created_at: true,
  deleted_at: true,
};

function parsePositiveId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function handleUserUniqueConflict(res, username, email, excludeId = null) {
  const conflict = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
      ...(excludeId ? { user_id: { not: excludeId } } : {}),
    },
    select: { deleted_at: true },
  });
  if (conflict?.deleted_at) {
    return res.status(409).json({
      code: "USER_ARCHIVED_EXISTS",
      message: "An archived staff account already uses this username or email. Restore it from Archived users instead.",
    });
  }
  return res.status(409).json({ message: "Username or email already exists" });
}

export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { deleted_at: null },
      select: USER_PUBLIC_SELECT,
      orderBy: { created_at: "desc" },
    });

    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getArchivedUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { deleted_at: { not: null } },
      select: USER_PUBLIC_SELECT,
      orderBy: { deleted_at: "desc" },
    });

    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getUserById = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  try {
    const user = await prisma.user.findFirst({
      where: { user_id: id, deleted_at: null },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const createUser = async (req, res) => {
  const cleanUsername = String(req.body.username || "").trim();
  const cleanEmail = String(req.body.email || "").trim();
  const { password, role } = req.body;

  if (!cleanUsername || !cleanEmail || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (role === "admin") {
    return res.status(403).json({
      code: "ADMIN_CREATE_FORBIDDEN",
      message: "Creating another admin account is disabled.",
    });
  }

  if (!STAFF_ROLES.has(role)) {
    return res.status(400).json({ message: "Invalid staff role" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username: cleanUsername, email: cleanEmail, password: hashed, role },
      select: USER_PUBLIC_SELECT,
    });
    res.status(201).json(user);
  } catch (error) {
    if (error.code === "P2002") {
      return handleUserUniqueConflict(res, cleanUsername, cleanEmail);
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const updateUser = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  const cleanUsername = String(req.body.username || "").trim();
  const cleanEmail = String(req.body.email || "").trim();
  const { role, password } = req.body;

  if (!cleanUsername || !cleanEmail || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { user_id: id, deleted_at: null },
      select: { user_id: true, role: true },
    });
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (existing.role === "admin") {
      if (req.user?.userId && req.user.userId !== id) {
        return res.status(403).json({ message: "Cannot modify another admin account." });
      }
      if (role !== "admin") {
        return res.status(400).json({ message: "Admin role cannot be changed." });
      }
    } else {
      if (role === "admin") {
        return res.status(403).json({
          code: "ADMIN_CREATE_FORBIDDEN",
          message: "Cannot promote a staff account to admin.",
        });
      }
      if (!STAFF_ROLES.has(role)) {
        return res.status(400).json({ message: "Invalid staff role" });
      }
    }

    const updateData = { username: cleanUsername, email: cleanEmail, role };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { user_id: id },
      data: updateData,
      select: USER_PUBLIC_SELECT,
    });

    res.status(200).json(user);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    if (error.code === "P2002") {
      return handleUserUniqueConflict(res, cleanUsername, cleanEmail, id);
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  if (req.user?.userId === id) {
    return res.status(400).json({
      code: "CANNOT_DELETE_SELF",
      message: "You cannot delete your own account.",
    });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { user_id: id, deleted_at: null },
      select: {
        user_id: true,
        role: true,
        _count: { select: { orders: true, payments: true, stock_orders: true } },
      },
    });

    if (!existing) return res.status(404).json({ message: "User not found" });

    if (existing.role === "admin") {
      return res.status(403).json({
        code: "CANNOT_DELETE_ADMIN",
        message: "Admin accounts cannot be deleted.",
      });
    }

    const hasHistory =
      (existing._count.orders || 0) > 0 ||
      (existing._count.payments || 0) > 0 ||
      (existing._count.stock_orders || 0) > 0;

    if (!hasHistory) {
      try {
        await prisma.user.delete({ where: { user_id: id } });
        return res.status(200).json({ message: "User deleted successfully", archived: false });
      } catch (err) {
        if (err.code !== "P2003") throw err;
      }
    }

    await prisma.user.update({
      where: { user_id: id },
      data: { deleted_at: new Date() },
    });

    return res.status(200).json({
      message: "Staff account archived (order/payment history preserved)",
      archived: true,
    });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const restoreUser = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await prisma.user.findUnique({ where: { user_id: id } });
    if (!existing) return res.status(404).json({ message: "User not found" });
    if (!existing.deleted_at) return res.status(400).json({ message: "User is not archived" });

    const restored = await prisma.user.update({
      where: { user_id: id },
      data: { deleted_at: null },
      select: USER_PUBLIC_SELECT,
    });

    res.status(200).json({ message: "User restored", user: restored });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "User not found" });
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
