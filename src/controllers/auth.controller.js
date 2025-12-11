// src/controllers/auth.controller.js

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const token = signToken(user._id);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// 👇 แทนที่ส่วนนี้
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log("Login attempt:", { email, password }); // debug
    
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email });
    console.log("User found:", user); // debug
    
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    console.log("Comparing:", { password, hash: user.passwordHash }); // debug
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log("Password match:", ok); // debug
    
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user._id);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    console.error("Login error:", e); // debug
    res.status(500).json({ message: e.message });
  }
};

export const profile = async (req, res) => {
  const user = await User.findById(req.userId).select("_id name email createdAt");
  res.json({ user });
};