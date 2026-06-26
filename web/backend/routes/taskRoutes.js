// taskRoutes.js
const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const taskController = require("../controllers/taskController");

router.post("/create", auth, taskController.createTask);

router.get("/all", auth, taskController.getAllTasks);

router.get("/my", auth, taskController.getMyTasks);

router.get("/:id", auth, taskController.getTaskDetails);

router.put("/status/:id", auth, taskController.updateStatus);
router.delete("/:id", auth, taskController.deleteTask);

module.exports = router;
