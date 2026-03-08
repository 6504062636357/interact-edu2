import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Omise from "omise";
import axios from "axios";

import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";
import { firebaseAuth } from "../middlewares/firebaseAuth.js";

const router = express.Router();

const omise = Omise({
  publicKey: process.env.OMISE_PUBLIC_KEY,
  secretKey: process.env.OMISE_SECRET_KEY,
});

console.log("PUBLIC:", process.env.OMISE_PUBLIC_KEY);
console.log("SECRET:", process.env.OMISE_SECRET_KEY);

/// =======================================
/// PROMPTPAY QR: CREATE PAYMENT
/// POST /api/payments/create
/// =======================================
router.post("/create", firebaseAuth, async (req, res) => {
  try {
    const { courseId, amount } = req.body;

    if (!courseId || !amount) {
      return res.status(400).json({
        message: "courseId and amount are required",
      });
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        message: "amount must be a valid number greater than 0",
      });
    }

    /// สร้าง charge แบบ PromptPay
    const charge = await omise.charges.create({
      amount: Math.round(parsedAmount * 100), // satang
      currency: "thb",
      source: {
        type: "promptpay",
      },
    });
    console.log("QR BASE64 LENGTH:", qrBase64.length);
    console.log("FULL CHARGE OBJECT:", JSON.stringify(charge, null, 2));

    /// URL นี้ต้องใช้ secret key ถึงจะโหลดได้
    const qrDownloadUrl = charge.source?.scannable_code?.image?.download_uri;

    if (!qrDownloadUrl) {
      return res.status(500).json({
        message: "QR download URL not found from Omise response",
      });
    }

    console.log("QR DOWNLOAD URL:", qrDownloadUrl);

    /// fetch QR จาก Omise ด้วย secret key
    const qrImage = await axios.get(qrDownloadUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.OMISE_SECRET_KEY,
        password: "",
      },
    });

    /// Omise ส่ง qr เป็น svg
    const qrBase64 = Buffer.from(qrImage.data).toString("base64");
    const qrDataUrl = `data:image/svg+xml;base64,${qrBase64}`;

    /// บันทึก payment ไว้ก่อน สถานะ pending
    const payment = await Payment.create({
      user: req.user._id,
      course: courseId,
      amount: parsedAmount,
      chargeId: charge.id,
      status: charge.status || "pending",
    });

    return res.status(200).json({
      message: "PromptPay QR created",
      paymentId: payment._id,
      chargeId: charge.id,
      qr: qrDataUrl,
      status: charge.status || "pending",
      expiresAt: charge.expires_at || null,
    });
  } catch (err) {
    console.error("CREATE QR ERROR:", err);

    return res.status(500).json({
      message: "Create QR failed",
      error: err.message,
    });
  }
});

/// =======================================
/// CHECK PAYMENT STATUS
/// GET /api/payments/status/:id
/// =======================================
router.get("/status/:id", firebaseAuth, async (req, res) => {
  try {
    const chargeId = req.params.id;

    if (!chargeId) {
      return res.status(400).json({
        message: "chargeId is required",
      });
    }

    const charge = await omise.charges.retrieve(chargeId);

    /// อัปเดต payment status ใน DB
    const payment = await Payment.findOne({ chargeId });

    if (payment) {
      payment.status = charge.status;
      await payment.save();

      /// ถ้าจ่ายสำเร็จ ค่อย enroll
      if (charge.status === "successful") {
        const existingEnrollment = await Enrollment.findOne({
          user: payment.user,
          course: payment.course,
        });

        if (!existingEnrollment) {
          await Enrollment.create({
            user: payment.user,
            course: payment.course,
            progress: 0,
            status: "active",
          });
        }
      }
    }

    return res.status(200).json({
      chargeId: charge.id,
      status: charge.status,
      paid: charge.paid,
      expiresAt: charge.expires_at || null,
    });
  } catch (err) {
    console.error("CHECK PAYMENT STATUS ERROR:", err);

    return res.status(500).json({
      message: "Check payment failed",
      error: err.message,
    });
  }
});

/// =======================================
/// CREDIT CARD PAYMENT (TEST MODE)
/// POST /api/payments/card
/// =======================================
router.post("/card", firebaseAuth, async (req, res) => {
  try {
    const { courseId, amount, token } = req.body;

    if (!courseId || !amount || !token) {
      return res.status(400).json({
        message: "courseId, amount and token are required",
      });
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        message: "amount must be a valid number greater than 0",
      });
    }

    /// charge บัตร
    const charge = await omise.charges.create({
      amount: Math.round(parsedAmount * 100),
      currency: "thb",
      card: token,
    });

    if (charge.status !== "successful") {
      return res.status(400).json({
        message: "Card payment failed",
        status: charge.status,
      });
    }

    /// save payment
    const payment = await Payment.create({
      user: req.user._id,
      course: courseId,
      amount: parsedAmount,
      chargeId: charge.id,
      status: charge.status,
    });

    /// enroll ถ้ายังไม่มี
    const existingEnrollment = await Enrollment.findOne({
      user: req.user._id,
      course: courseId,
    });

    let enrollment = existingEnrollment;

    if (!existingEnrollment) {
      enrollment = await Enrollment.create({
        user: req.user._id,
        course: courseId,
        progress: 0,
        status: "active",
      });
    }

    return res.status(200).json({
      message: "Card payment successful",
      payment,
      enrollment,
    });
  } catch (err) {
    console.error("CARD PAYMENT ERROR:", err);

    return res.status(500).json({
      message: "Card payment failed",
      error: err.message,
    });
  }
});

export default router;