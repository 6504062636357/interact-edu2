import express from "express";
import User from "../models/User.js";
import admin from "../config/firebaseAdmin.js"; // Import admin ตรงๆ สำหรับ /sync
import { firebaseAuth } from "../middlewares/firebaseAuth.js"; // สำหรับ /me

const router = express.Router();

// ==========================================
// 1. ROUTE สำหรับ SYNC (สร้าง User ใหม่)
// ==========================================
// เราไม่ใช้ firebaseAuth middleware ตรงนี้ เพราะมันจะไป findOne แล้วพ่น 404 ออกมาดักหน้า
router.post("/sync", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];

    // ตรวจสอบ Token กับ Firebase (Verify Only)
    const decoded = await admin.auth().verifyIdToken(idToken);
    const authUid = decoded.uid;

    // หา User ถ้าไม่เจอให้สร้างใหม่ (Upsert Logic)
    let user = await User.findOneAndUpdate(
      { authUid: authUid },
      {
        authUid: authUid,
        email: decoded.email || "",
        name: decoded.name || "User",
        photoUrl: decoded.picture || "",
        role: "student",
      },
      { upsert: true, new: true } // ถ้าไม่มีให้สร้าง ถ้ามีให้อัปเดต
    );

    return res.status(201).json({ message: "User synced successfully", user });
  } catch (err) {
    console.error("SYNC ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token or Sync failed" });
  }
});

// ==========================================
// 2. ROUTE สำหรับดูโปรไฟล์ (GET ME)
// ==========================================
// ตรงนี้ใช้ firebaseAuth ได้ตามปกติ เพราะเรามั่นใจว่าผ่านการ Sync มาแล้ว
router.get("/me", firebaseAuth, async (req, res) => {
  try {
    // req.user ถูกยัดมาจาก firebaseAuth middleware
    if (!req.user) {
      return res.status(404).json({ message: "User profile not found" });
    }
    return res.json(req.user);
  } catch (err) {
    console.error("GET ME ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

export default router;