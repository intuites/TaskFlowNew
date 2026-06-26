//web/backend/controllers/adminController.js
const bcrypt = require("bcryptjs");
const supabase = require("../../../config/supabaseClient");

exports.createUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin only",
      });
    }

    const { username, email, password, department } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabase
      .from("users")
      .insert([
        {
          username,
          email,
          department,
        },
      ])
      .select()
      .single();

    if (userError) throw userError;

    const { error: accountError } = await supabase.from("web_accounts").insert([
      {
        user_id: user.id,
        email,
        password_hash: hash,
        role: "user",
      },
    ]);

    if (accountError) throw accountError;

    res.json({
      success: true,
      message: "User created",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
