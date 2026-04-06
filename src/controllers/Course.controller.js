// controllers/Course.controller.js

import Course from "../models/Course.js";

// Endpoint: GET /api/courses
export const getCourses = async (req, res) => {
  try {
    const { category, sort, search } = req.query;
    let filter = {};
    let sortOption = {};

    // 1. Filter ตามหมวดหมู่ (Maths, Robotic)
    if (category) {
      filter.category = category;
    }

    // 2. Search ตามชื่อคอร์ส
    if (search) {
      filter.title = { $regex: search, $options: 'i' }; // Case-insensitive search
    }

    // 3. Sort ตาม Popular/New
    if (sort === 'popular') {
      // Logic การจัดเรียงตามความนิยม (อาจนับจากจำนวนผู้ลงทะเบียน หรือคะแนนเฉลี่ย)
      // ณ จุดนี้ เราจะใช้ isHotCourse เป็นตัวอย่าง
      sortOption.isHotCourse = -1;
    } else if (sort === 'new') {
      sortOption.createdAt = -1; // จัดเรียงตามวันที่สร้างล่าสุด
    }
    // สำหรับ "All" หรือไม่มีการ Sort จะใช้ค่าเริ่มต้น

    const courses = await Course.find(filter).sort(sortOption);
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch courses", error: error.message });
  }
};

// Endpoint: GET /api/courses/categories
export const getCourseCategories = async (req, res) => {
  try {
    // ใช้ Aggregation Pipeline เพื่อดึงค่าที่ไม่ซ้ำกันของฟิลด์ 'category'
    const categories = await Course.aggregate([
      { $group: { _id: "$category" } }, // จัดกลุ่มตาม category
      { $project: { _id: 0, category: "$_id" } } // แสดงเฉพาะชื่อ category
    ]);

    // แปลงผลลัพธ์ให้อยู่ในรูปแบบ List of Strings
    const categoryNames = categories.map(c => c.category);
    res.status(200).json({ categories: categoryNames });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories", error: error.message });
  }
};