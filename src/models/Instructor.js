import mongoose from 'mongoose';

const instructorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String, default: "Expert" },
  imageUrl: { type: String },
  rating: { type: Number, default: 0 }
});

export default mongoose.model('Instructor', instructorSchema);