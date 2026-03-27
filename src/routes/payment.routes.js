import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Omise from "omise";
import axios from "axios";

import Payment from "../models/Payment.js";
import UserCourse from "../models/UserCourse.js";
import { firebaseAuth } from "../middlewares/firebaseAuth.js";

const router = express.Router();

const omise = Omise({
  publicKey: process.env.OMISE_PUBLIC_KEY,
  secretKey: process.env.OMISE_SECRET_KEY,
});

const findPaymentByChargeId = async (chargeId) => {
  return Payment.findOne({
    $or: [{ chargeId }, { omise_charge_id: chargeId }],
  });
};

const savePayment = async ({ userId, courseId, amount, chargeId, status }) => {
  let payment = await findPaymentByChargeId(chargeId);

  if (!payment) {
    payment = await Payment.create({
      user: userId,
      course: courseId,
      amount,
      chargeId,
      omise_charge_id: chargeId,
      status,
    });
  } else {
    payment.user = userId;
    payment.course = courseId;
    payment.amount = amount;
    payment.chargeId = chargeId;
    payment.omise_charge_id = chargeId;
    payment.status = status;
    await payment.save();
  }

  return payment;
};

const enrollIfNeeded = async (userId, courseId) => {
  const existingUserCourse = await UserCourse.findOne({
    userId: userId,
    courseId: courseId,
  });

  if (!existingUserCourse) {
    return UserCourse.create({
      userId: userId,
      courseId: courseId,
      progress: 0,
      completed: false,
      lastAccess: new Date(),
    });
  }

  return existingUserCourse;
};

const ensureCanPurchase = async (userId, courseId) => {
  const existingUserCourse = await UserCourse.findOne({
    userId: userId,
    courseId: courseId,
  });

  if (existingUserCourse) {
    return {
      allowed: false,
      statusCode: 409,
      body: {
        message: "You already purchased this course",
        alreadyPurchased: true,
      },
    };
  }

  const existingPendingPayment = await Payment.findOne({
    user: userId,
    course: courseId,
    status: "pending",
  }).sort({ createdAt: -1 });

  if (!existingPendingPayment) {
    return { allowed: true };
  }

  const existingChargeId =
    existingPendingPayment.chargeId || existingPendingPayment.omise_charge_id;

  if (!existingChargeId) {
    return {
      allowed: false,
      statusCode: 409,
      body: {
        message: "You already have a pending payment for this course",
        pendingPayment: true,
      },
    };
  }

  try {
    const existingCharge = await omise.charges.retrieve(existingChargeId);

    existingPendingPayment.status = existingCharge.status;
    existingPendingPayment.chargeId = existingCharge.id;
    existingPendingPayment.omise_charge_id = existingCharge.id;
    await existingPendingPayment.save();

    if (existingCharge.status === "successful") {
      await enrollIfNeeded(existingPendingPayment.user, existingPendingPayment.course);

      return {
        allowed: false,
        statusCode: 409,
        body: {
          message: "You already purchased this course",
          alreadyPurchased: true,
          chargeId: existingCharge.id,
        },
      };
    }

    if (existingCharge.status === "pending") {
      return {
        allowed: false,
        statusCode: 409,
        body: {
          message: "You already have a pending payment for this course",
          pendingPayment: true,
          chargeId: existingCharge.id,
        },
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("CHECK EXISTING PENDING PAYMENT ERROR:", err.message);

    return {
      allowed: false,
      statusCode: 409,
      body: {
        message: "You already have a pending payment for this course",
        pendingPayment: true,
        chargeId: existingChargeId,
      },
    };
  }
};

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

    const purchaseCheck = await ensureCanPurchase(req.user._id, courseId);

    if (!purchaseCheck.allowed) {
      return res.status(purchaseCheck.statusCode).json(purchaseCheck.body);
    }

    const charge = await omise.charges.create({
      amount: Math.round(parsedAmount * 100),
      currency: "thb",
      source: {
        type: "promptpay",
      },
    });

    const qrDownloadUrl = charge.source?.scannable_code?.image?.download_uri;

    if (!qrDownloadUrl) {
      return res.status(500).json({
        message: "QR image URL not found from Omise",
      });
    }

    const qrImage = await axios.get(qrDownloadUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.OMISE_SECRET_KEY,
        password: "",
      },
    });

    const contentType = qrImage.headers["content-type"] || "image/svg+xml";
    const qrBase64 = Buffer.from(qrImage.data).toString("base64");
    const qrDataUrl = `data:${contentType};base64,${qrBase64}`;

    const payment = await savePayment({
      userId: req.user._id,
      courseId,
      amount: parsedAmount,
      chargeId: charge.id,
      status: charge.status,
    });

    console.log("CREATE PAYMENT:", {
      paymentId: payment._id,
      chargeId: charge.id,
      status: charge.status,
    });

    return res.status(200).json({
      payment,
      chargeId: charge.id,
      qr: qrDataUrl,
      status: charge.status,
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

router.get("/status/:id", firebaseAuth, async (req, res) => {
  try {
    const chargeId = req.params.id;

    if (!chargeId) {
      return res.status(400).json({
        message: "chargeId is required",
      });
    }

    const charge = await omise.charges.retrieve(chargeId);
    const payment = await findPaymentByChargeId(chargeId);

    if (payment) {
      payment.status = charge.status;
      payment.chargeId = charge.id;
      payment.omise_charge_id = charge.id;
      await payment.save();

      if (charge.status === "successful") {
        await enrollIfNeeded(payment.user, payment.course);
      }

      console.log("STATUS UPDATED PAYMENT:", {
        paymentId: payment._id,
        chargeId: charge.id,
        status: charge.status,
      });
    } else {
      console.log("STATUS: payment not found for charge", chargeId);
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

    const purchaseCheck = await ensureCanPurchase(req.user._id, courseId);

    if (!purchaseCheck.allowed) {
      return res.status(purchaseCheck.statusCode).json(purchaseCheck.body);
    }

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

    const payment = await savePayment({
      userId: req.user._id,
      courseId,
      amount: parsedAmount,
      chargeId: charge.id,
      status: charge.status,
    });

    const enrollment = await enrollIfNeeded(req.user._id, courseId);

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