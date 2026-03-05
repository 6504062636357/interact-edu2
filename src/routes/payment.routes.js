import express from 'express';
import Payment from '../models/Payment';    
import Enrollment from '../models/Enrollment';
import {firebaseAuth} from '../middleware/firebaseAuth.js';

const router = express.Router();

router.post('/payment', firebaseAuth, async (req, res) => {
  try {
    const { courseId, amount} = req.body;

    const payment = await Payment.create({
      user: userId,
      course: courseId,
      amount: amount,
      status: 'success'
    });
    await Enrollment.create({
        user: req.user.uid,
        course: courseId,
        progress: 0,
        status: 'active',
    });

    res.json({ 
        message: "Course purchased ",payment
    });
    } catch (error) {
        console.error(err);
        res.status(500).json({ message: 'Purchase failed' });
    }
    });
    
    export default router;