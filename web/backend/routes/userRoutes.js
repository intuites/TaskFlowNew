// userRoutes.js
const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const userController = require("../controllers/userController");

router.get("/departments", userController.getDepartments);

router.get("/department/:department", userController.getUsersByDepartment);

router.post("/create", auth, userController.createUser);
router.get("/", auth, userController.getAllUsers);
router.delete("/:id", auth, userController.deleteUser);

module.exports = router;

// const express = require("express");

// const router = express.Router();

// const userController = require("../controllers/userController");

// router.get("/departments", userController.getDepartments);

// router.get("/department/:department", userController.getUsersByDepartment);
// router.post("/create", auth, userController.createUser);

// module.exports = router;
