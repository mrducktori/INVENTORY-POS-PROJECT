import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import posRoutes from "./routes/pos.js";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/pos", posRoutes);

app.get("/", (req, res) => {
  res.send("POS System API");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


app.get("/", (req, res) => {
  res.send("API is running...");
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});