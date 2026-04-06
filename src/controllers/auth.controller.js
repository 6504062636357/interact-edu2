import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import User from "../models/User.js";

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- ✅ 1. Signup แบบปกติ (ของเดิม) ---
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      authUid: `local_${Date.now()}`,
      name,
      email,
      passwordHash,
      role: "student",
      status: "approved",
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        authUid: user.authUid,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// --- ✅ 2. Login แบบปกติ (ของเดิม) ---
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: "This account uses Firebase sign-in" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        authUid: user.authUid,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: e.message });
  }
};

// --- ✅ 3. Profile (ของเดิม) ---
export const profile = async (req, res) => {
  const user = await User.findById(req.userId).select("_id name email createdAt");
  res.json({ user });
};

// --- ✅ 4. Register With Firebase (ของใหม่ที่รองรับ 3 ไฟล์) ---
export const registerWithFirebase = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);
    console.log("FIREBASE:", req.firebase);

    const {
      authUid,
      email,
      name,
      role = "student",
      teacherSubject,
      degreeCertificateUrl,
      teachingLicenseUrl,
      transcriptUrl,
    } = req.body || {};

    if (!req.firebase) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!authUid || !email || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (req.firebase.uid !== authUid) {
      return res.status(403).json({ message: "Token UID does not match authUid" });
    }

    const normalizedRole = role === "teacher" ? "teacher" : "student";
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [
        { authUid },
        { email: normalizedEmail },
        { email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") },
      ],
    });

    if (normalizedRole === "teacher") {
      if (!teacherSubject || !teacherSubject.trim()) {
        return res.status(400).json({ message: "Teacher subject is required" });
      }

      if (!degreeCertificateUrl || !teachingLicenseUrl || !transcriptUrl) {
        return res.status(400).json({
          message: "Teacher document URLs are required",
        });
      }
    }

    const nextStatus =
      normalizedRole === "teacher"
        ? existingUser?.status === "approved"
          ? "approved"
          : "pending"
        : "approved";

    const setFields = {
      authUid,
      name: name.trim(),
      email: normalizedEmail,
      role: normalizedRole,
      status: nextStatus,
      ...(normalizedRole === "teacher"
        ? {
            subject: teacherSubject.trim(),
            degreeCertificateUrl: degreeCertificateUrl.trim(),
            teachingLicenseUrl: teachingLicenseUrl.trim(),
            transcriptUrl: transcriptUrl.trim(),
          }
        : {
            subject: "",
            degreeCertificateUrl: "",
            teachingLicenseUrl: "",
            transcriptUrl: "",
          }),
    };

    const matchQuery = existingUser ? { _id: existingUser._id } : { authUid };

    const user = await User.findOneAndUpdate(
      matchQuery,
      {
        $set: setFields,
        $setOnInsert: {
          learnedToday: 0,
          goalMinutes: 60,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return res.status(201).json({
      message: "User registered successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("REGISTER WITH FIREBASE ERROR:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};