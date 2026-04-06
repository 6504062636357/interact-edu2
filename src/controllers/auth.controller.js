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
    const {
      authUid,
      email,
      name,
      role = "student",
      teacherSubject,
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

    let degreeCertificateUrl = "";
    let teachingLicenseUrl = "";
    let transcriptUrl = "";

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

      // ตรวจสอบว่ามีไฟล์ส่งมาไหม
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ message: "Teacher documents are required" });
      }

      const uploadDir = path.join(process.cwd(), "uploads", "teacher_documents");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const extByMime = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
      };

      const saveFile = (fileArray, prefix) => {
        const file = fileArray[0];
        const ext = extByMime[file.mimetype] || path.extname(file.originalname) || ".pdf";
        const safeFileName = `${prefix}_${authUid}_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, safeFileName);
        fs.writeFileSync(filePath, file.buffer);
        return `/uploads/teacher_documents/${safeFileName}`;
      };

      if (req.files.degreeCertificateUrl) {
        degreeCertificateUrl = saveFile(req.files.degreeCertificateUrl, "degree");
      }
      if (req.files.teachingLicenseUrl) {
        teachingLicenseUrl = saveFile(req.files.teachingLicenseUrl, "license");
      }
      if (req.files.transcriptUrl) {
        transcriptUrl = saveFile(req.files.transcriptUrl, "transcript");
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
            degreeCertificateUrl,
            teachingLicenseUrl,
            transcriptUrl,
          }
        : { 
            subject: "", 
            degreeCertificateUrl: "", 
            teachingLicenseUrl: "", 
            transcriptUrl: "" 
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