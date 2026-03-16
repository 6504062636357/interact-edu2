import express from "express";
import User from "../models/User.js";
import admin from "../config/firebaseAdmin.js";
import { firebaseAuth } from "../middlewares/firebaseAuth.js";

const router = express.Router();


// ===============================
// SYNC USER (Firebase → MongoDB)
// ===============================
router.post("/sync", async (req, res) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];

    // verify firebase token
    const decoded = await admin.auth().verifyIdToken(idToken);

    const authUid = decoded.uid;
    const email = decoded.email || "";
    const name = decoded.name || decoded.email?.split("@")[0] || "User";
    const photoUrl = decoded.picture || "";

    // UPSERT USER
    const user = await User.findOneAndUpdate(
      {
        $or: [
          { authUid: authUid },
          { email: email }
        ]
      },
      {
        $set: {
          authUid: authUid,
          email: email,
          name: name,
          photoUrl: photoUrl
        },
        $setOnInsert: {
          role: "student",
          learnedToday: 0,
          goalMinutes: 60
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    return res.status(200).json({
      message: "User synced successfully",
      user
    });

  } catch (err) {

    console.error("SYNC ERROR:", err);

    return res.status(500).json({
      message: "Sync failed"
    });

  }
});


// ===============================
// GET PROFILE
// ===============================
router.get("/me", firebaseAuth, async (req, res) => {
  try {

    if (!req.user) {
      return res.status(404).json({
        message: "User profile not found"
      });
    }

    res.json(req.user);

  } catch (err) {

    console.error("GET ME ERROR:", err);

    res.status(500).json({
      message: "Failed to fetch profile"
    });

  }
});

export default router;