import admin from "../config/firebaseAdmin.js";
import User from "../models/User.js";

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.firebase = decodedToken;
    next();
  } catch (error) {
    console.error("VERIFY FIREBASE TOKEN ERROR:", error.message);
    return res.status(401).json({ message: "Invalid or expired Firebase token" });
  }
};

export const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const user = await User.findOne({ authUid: decodedToken.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found in DB" });
    }

    req.firebase = decodedToken;
    req.user = user;

    next();
  } catch (error) {
    console.error("FIREBASE AUTH ERROR:", error.message);
    return res.status(401).json({ message: "Invalid or expired Firebase token" });
  }
};