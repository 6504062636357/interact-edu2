import express from "express";
import Payment from "../models/Payment.js";
import UserCourse from "../models/UserCourse.js";

const router = express.Router();

const findPaymentByChargeId = async (chargeId) => {
  return Payment.findOne({
    $or: [{ chargeId }, { omise_charge_id: chargeId }],
  });
};

const enrollIfNeeded = async (userId, courseId) => {
  const existingUserCourse = await UserCourse.findOne({
    userId,
    courseId,
  });

  if (!existingUserCourse) {
    return UserCourse.create({
      userId,
      courseId,
      progress: 0,
      completed: false,
      lastAccess: new Date(),
    });
  }

  return existingUserCourse;
};

router.post("/omise", async (req, res) => {
  try {
    const event = req.body;

    if (event.key === "charge.complete") {
      const charge = event.data;
      if (!charge?.id) return res.sendStatus(200);

      const payment = await findPaymentByChargeId(charge.id);
      if (!payment) return res.sendStatus(200);

      payment.status = charge.status;
      payment.chargeId = charge.id;
      payment.omise_charge_id = charge.id;
      await payment.save();

      if (charge.status === "successful") {
        await enrollIfNeeded(payment.user, payment.course);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("OMISE WEBHOOK ERROR:", err);
    return res.sendStatus(500);
  }
});

export default router;