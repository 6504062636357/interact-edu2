import { Router } from "express";
import multer from "multer";
import {
  signup,
  login,
  profile,
  registerWithFirebase,
} from "../controllers/auth.controller.js";
import auth from "../middlewares/auth.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG, PNG are allowed"));
    }
  },
});

const uploadTeacherDocument = (req, res, next) => {
  upload.fields([
    { name: "degreeCertificateUrl", maxCount: 1 },
    { name: "teachingLicenseUrl", maxCount: 1 },
    { name: "transcriptUrl", maxCount: 1 }
  ])(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ message: err.message || "Invalid upload" });
  });
};
router.post("/register", verifyFirebaseToken, uploadTeacherDocument, registerWithFirebase);
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", auth, profile);


export default router;
