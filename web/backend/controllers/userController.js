// C:\Users\Admin\Desktop\projects\TaskFlow\web\backend\controllers\userController.js
const supabase = require("../../../config/supabaseClient");

// =========================
// GET ALL DEPARTMENTS
// =========================

exports.getDepartments = async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("department");

    if (error) throw error;

    const departments = [
      ...new Set((data || []).map((row) => row.department).filter(Boolean)),
    ];

    res.json(departments);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =========================
// GET USERS BY DEPARTMENT
// =========================

exports.getUsersByDepartment = async (req, res) => {
  try {
    const department = req.params.department;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("department", department);

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ////////////////////////////////////////////////////////////////////////////////////
const bcrypt = require("bcryptjs");

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

    const { data: user, error } = await supabase
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

    if (error) throw error;

    const { error: webError } = await supabase.from("web_accounts").insert([
      {
        email,
        password_hash: hash,
        role: "user",
        user_id: user.id,
        must_change_password: true,
      },
    ]);

    if (webError) throw webError;

    res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    console.log("GET ALL USERS CALLED");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    console.log("USERS:", data);

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.log("GET USERS ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Delte users

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin only",
      });
    }

    const userId = req.params.id;

    // delete login account first
    const { error: accountError } = await supabase
      .from("web_accounts")
      .delete()
      .eq("user_id", userId);

    if (accountError) throw accountError;

    // delete user
    const { error: userError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userError) throw userError;

    res.json({
      success: true,
      message: "User deleted",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// exports.deleteUser = async (req, res) => {
//   try {
//     if (req.user.role !== "admin") {
//       return res.status(403).json({
//         success: false,
//         message: "Admin only",
//       });
//     }

//     const userId = req.params.id;

//     const { error } = await supabase.from("users").delete().eq("id", userId);

//     if (error) throw error;

//     res.json({
//       success: true,
//       message: "User deleted",
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };
