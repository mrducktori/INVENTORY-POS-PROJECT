import express from "express";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";

const router = express.Router();

// Test endpoint to check Supabase connection
router.get("/test", async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("*");

    res.json({ connected: !error, data, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    // Compare password with bcrypt hash

    let isPasswordValid = false;

    // Check if password_hash looks like a bcrypt hash (starts with $2)
    if (data.password_hash && data.password_hash.startsWith('$2')) {
      // It's a bcrypt hash, use bcrypt comparison
      isPasswordValid = await bcrypt.compare(password, data.password_hash);
    } else {
      // It's plain text, do plain text comparison
      isPasswordValid = password === data.password_hash;
    }

    if (!isPasswordValid) {
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
