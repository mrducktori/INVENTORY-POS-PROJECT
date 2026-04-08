import express from "express";
import { supabase } from "../../db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Query users table for user
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Check if user is active
    if (data.status !== "ACTIVE") {
      return res.status(401).json({ error: "User account is not active" });
    }

    // Compare password with hash (direct comparison - use bcrypt for production)
    if (data.password_hash !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = data;
    res.json(userWithoutPassword);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
