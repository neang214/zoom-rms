import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");

import authRoutes          from "./modules/auth/auth.route.js";
import userRoutes          from "./modules/users/user.route.js";
import menuCategoryRoutes  from "./modules/menuCategories/menuCategory.route.js";
import menuItemRoutes      from "./modules/menuItems/menuItem.route.js";
import tableRoutes         from "./modules/tables/table.route.js";
import orderRoutes         from "./modules/orders/order.route.js";
import orderItemRoutes     from "./modules/orderItems/orderItem.route.js";
import paymentRoutes       from "./modules/payments/payment.route.js";
import paymentMethodRoutes from "./modules/paymentMethods/paymentMethod.route.js";
import stockRoutes         from "./modules/stock/stock.route.js";
import stockOrderRoutes    from "./modules/stockOrders/stockOrder.route.js";
import supplierRoutes      from "./modules/suppliers/supplier.route.js";
import analyticsRoutes     from "./modules/analytics/analytics.route.js";
import unitRouter          from "./modules/unit/unit.route.js";
import khqrRoutes          from "./modules/payments/khqr.route.js";
import guestSessionRoutes  from "./modules/guestSession/guestSession.route.js";
import { isAllowedOrigin } from "./sockets/index.js";

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

export { isAllowedOrigin };

const allowedOrigins = [
  "https://zoom-rms.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map(s => s.trim().replace(/\/$/, "")) : []),
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map(s => s.trim().replace(/\/$/, "")) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-session"],
}));

app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Zoom RMS Backend API is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth",            authRoutes);
app.use("/api/users",           userRoutes);
app.use("/api/guest-sessions",  guestSessionRoutes);
app.use("/api/menu-categories", menuCategoryRoutes);
app.use("/api/menu-items",      menuItemRoutes);
app.use("/api/tables",          tableRoutes);
app.use("/api/orders",          orderRoutes);
app.use("/api/order-items",     orderItemRoutes);
app.use("/api/payments",        paymentRoutes);
app.use("/api/payments/khqr",   khqrRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/stock",           stockRoutes);
app.use("/api/stock-orders",    stockOrderRoutes);
app.use("/api/suppliers",       supplierRoutes);
app.use("/api/analytics",       analyticsRoutes);
app.use("/api/units",           unitRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image file size must be 5MB or less" : err.message;
    return res.status(400).json({ message });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

export { app };