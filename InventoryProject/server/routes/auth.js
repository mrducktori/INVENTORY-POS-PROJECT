import express from "express";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import { logAudit } from "../utils/auditHelper.js";

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

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      // Log failed login attempt (no user_id since we don't know who)
      await logAudit("LOGIN_FAILED", null, { username, reason: "User not found" });
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (data.status !== "ACTIVE") {
      await logAudit("LOGIN_FAILED", data.id, { username, reason: "Account inactive" });
      return res.status(401).json({ error: "User account is not active" });
    }

    let isPasswordValid = false;
    if (data.password_hash && data.password_hash.startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(password, data.password_hash);
    } else {
      isPasswordValid = password === data.password_hash;
    }

    if (!isPasswordValid) {
      await logAudit("LOGIN_FAILED", data.id, { username, reason: "Wrong password" });
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Successful login
    await logAudit("LOGIN", data.id, { username: data.username, role: data.role });

    const { password_hash, ...userWithoutPassword } = data;
    res.json(userWithoutPassword);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT (called by frontend before clearing localStorage)
router.post("/logout", async (req, res) => {
  try {
    const { user_id, username, role } = req.body;
    await logAudit("LOGOUT", user_id || null, { username, role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
