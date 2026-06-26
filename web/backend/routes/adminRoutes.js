// C:\Users\Admin\Desktop\projects\TaskFlow\web\backend\routes\adminRoutes.js
const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const adminController = require("../controllers/adminController");

router.post("/users/create", auth, adminController.createUser);

module.exports = router;
