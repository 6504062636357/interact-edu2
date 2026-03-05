import express from 'express';
const router = express.Router();

// ต้องใส่ .js ท้ายชื่อไฟล์เสมอนะครับ
import Instructor from '../models/Instructor.js';

// GET /api/instructors
router.get('/', async (req, res) => {
    try {
        const instructors = await Instructor.find();
        res.json(instructors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// เปลี่ยนจาก module.exports เป็น export default
export default router;