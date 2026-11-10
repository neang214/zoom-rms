import { generateToken } from "../../utils/generateToken.js";
import prisma from '../../utils/db.js';
import bcrypt from 'bcrypt';

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || user.deleted_at) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user, res);

    res.status(200).json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({ message: "Logout successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.userId },
      select: {
        user_id: true,
        username: true,
        email: true,
        role: true,
        created_at: true,
        deleted_at: true,
      },
    });

    if (!user || user.deleted_at) {
      return res.status(401).json({ message: "Account is inactive or deleted" });
    }

    const { deleted_at, ...safeUser } = user;
    res.status(200).json(safeUser);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
