import express from "express";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";

const router = express.Router();

router.post("/omise", async (req, res) => {
  try {
    const event = req.body;

    // สนใจเฉพาะ event ที่ charge เสร็จสมบูรณ์
    if (event.key === "charge.complete") {
      const charge = event.data;

      if (!charge?.id) {
        return res.sendStatus(200);
      }

      const payment = await Payment.findOne({ chargeId: charge.id });

      if (!payment) {
        return res.sendStatus(200);
      }

      // อัปเดตสถานะ payment
      payment.status = charge.status;
      await payment.save();

      // ถ้าจ่ายสำเร็จ ค่อย enroll
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

    return res.sendStatus(200);
  } catch (err) {
    console.error("OMISE WEBHOOK ERROR:", err);
    return res.sendStatus(500);
  }
});

export default router;