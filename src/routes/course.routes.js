// routes/course.routes.js

import express from 'express';
import { getCourses, getCourseCategories } from '../controllers/Course.controller.js';

const router = express.Router();

// ดึงรายการหมวดหมู่ทั้งหมด: Maths, Robotic
router.get('/courses/categories', getCourseCategories);

// ดึงรายการคอร์สทั้งหมด: รองรับ /courses?category=Maths&sort=popular
router.get('/courses', getCourses);

export default router;