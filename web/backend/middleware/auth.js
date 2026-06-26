// middleware/auth.js

const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  try {
    console.log("AUTH HEADER:", req.headers.authorization);

    const token = req.headers.authorization?.split(" ")[1];

    console.log("TOKEN:", token);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("DECODED USER:", decoded);

    req.user = decoded;

    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.message);

    return res.status(401).json({
      success: false,
      message: err.message,
    });
  }
};

// const jwt = require("jsonwebtoken");
// function authHeaders() {
//   console.log("TOKEN:", localStorage.getItem("token"));

//   return {
//     "Content-Type": "application/json",

//     Authorization: "Bearer " + localStorage.getItem("token"),
//   };
// }

// module.exports = function (req, res, next) {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Token missing",
//       });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     req.user = decoded;

//     next();
//   } catch (err) {
//     return res.status(401).json({
//       success: false,
//       message: "Invalid token",
//     });
//   }
// };
