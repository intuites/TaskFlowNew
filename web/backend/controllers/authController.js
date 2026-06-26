// authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../../../config/supabaseClient");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("\n========== LOGIN ==========");
    console.log("EMAIL ENTERED:", email);
    console.log("PASSWORD ENTERED:", password);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    // =========================
    // TEST SUPABASE CONNECTION
    // =========================

    const { data: allAccounts, error: allError } = await supabase
      .from("web_accounts")
      .select("*");

    if (allError) {
      console.log("SUPABASE CONNECTION ERROR:");
      console.log(allError);

      return res.status(500).json({
        success: false,
        message: allError.message,
      });
    }

    console.log("\n========== ALL ACCOUNTS ==========");
    console.log(allAccounts);

    // =========================
    // FIND ACCOUNT
    // =========================

    const { data: account, error } = await supabase
      .from("web_accounts")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.log("ACCOUNT QUERY ERROR:");
      console.log(error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    console.log("\n========== ACCOUNT FOUND ==========");
    console.log(account);

    if (!account) {
      console.log("NO ACCOUNT FOUND FOR:", email);

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log("\n========== DATABASE USER ==========");
    console.log("ID:", account.id);
    console.log("EMAIL:", account.email);
    console.log("ROLE:", account.role);
    console.log("USER_ID:", account.user_id);
    console.log("HASH:", account.password_hash);

    // =========================
    // PASSWORD CHECK
    // =========================

    const valid = await bcrypt.compare(password, account.password_hash || "");

    console.log("\n========== PASSWORD CHECK ==========");
    console.log("PASSWORD VALID:", valid);

    if (!valid) {
      console.log("PASSWORD MISMATCH");

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // =========================
    // JWT TOKEN
    // =========================

    const token = jwt.sign(
      {
        id: account.id,
        role: account.role,
        user_id: account.user_id,
        email: account.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    console.log("\n========== LOGIN SUCCESS ==========");
    console.log("TOKEN GENERATED");

    return res.json({
      success: true,
      token,
      role: account.role,
      email: account.email,
    });
  } catch (err) {
    console.error("\n========== LOGIN ERROR ==========");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
// const bcrypt = require("bcryptjs");

// const jwt = require("jsonwebtoken");

// const supabase = require("../../../config/supabaseClient");

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password required",
//       });
//     }

//     const { data: account, error } = await supabase
//       .from("web_accounts")
//       .select("*")
//       .eq("email", email)
//       .maybeSingle();

//     if (error) {
//       throw error;
//     }

//     if (!account) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const valid = await bcrypt.compare(password, account.password_hash);

//     if (!valid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const token = jwt.sign(
//       {
//         id: account.id,
//         role: account.role,
//         user_id: account.user_id,
//         email: account.email,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "7d",
//       },
//     );

//     return res.json({
//       success: true,
//       token,
//       role: account.role,
//       email: account.email,
//     });
//   } catch (err) {
//     console.error(err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };
