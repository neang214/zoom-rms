import prisma from "../../utils/db.js";
import { createGuestSession } from "../../utils/guestSession.js";

export const createSession = async (req, res) => {
  const { qr_token } = req.body;

  if (!qr_token) {
    return res.status(400).json({ message: "qr_token is required" });
  }

  try {
    const table = await prisma.table.findUnique({
      where: { qr_token: String(qr_token) },
      select: { table_id: true, table_number: true, deleted_at: true },
    });

    if (!table || table.deleted_at) {
      return res.status(404).json({ message: "Invalid or expired table QR code" });
    }

    const { rawToken, expires_at } = await createGuestSession(table.table_id);

    res.status(201).json({
      session_token: rawToken,
      table_id: table.table_id,
      table_number: table.table_number,
      expires_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
