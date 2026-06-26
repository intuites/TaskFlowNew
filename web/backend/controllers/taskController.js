// taskController.js
const {
  taskService,
  userService,
  sendAssignmentEmail,
  sendCompletionEmail,
} = require("../services/webTaskService");

function getFirstReminderDate(frequency, customDays) {
  const next = new Date();

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;

    case "weekly":
      next.setDate(next.getDate() + 7);
      break;

    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;

    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;

    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;

    case "custom":
      next.setDate(next.getDate() + Number(customDays || 1));
      break;

    default:
      return null;
  }

  return next.toISOString();
}

// ===================================
// CREATE TASK
// ===================================

exports.createTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create tasks",
      });
    }

    const {
      userId,
      task,
      department,
      reminder_frequency,
      reminder_interval_days,
    } = req.body;
    //
    const intervalDays =
      reminder_interval_days === "" || reminder_interval_days === undefined
        ? null
        : Number(reminder_interval_days);
    //

    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const createdTask = await taskService.createTask({
      department,
      person: user.username || user.email,

      assigned_telegram_id: null,

      created_by_telegram_id: "WEB_ADMIN",

      chat_id: "WEB",

      task,

      reminder_frequency,

      reminder_interval_days,

      next_reminder_at: getFirstReminderDate(
        reminder_frequency,
        reminder_interval_days,
      ),
    });

    await taskService.addStatusHistory(createdTask.id, "Started", "WEB_ADMIN");

    if (user.email) {
      try {
        await sendAssignmentEmail(user.email, createdTask);
      } catch (err) {
        console.log("Email Error:", err.message);
      }
    }

    res.json({
      success: true,
      task: createdTask,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===================================
// ALL TASKS
// ===================================

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();

    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===================================
// MY TASKS
// ===================================

exports.getMyTasks = async (req, res) => {
  try {
    // const user = await userService.getUserById(req.user.user_id);

    // const tasks = await taskService.getTasksByPerson(user.username);
    if (!req.user.user_id) {
      return res.json([]);
    }

    const user = await userService.getUserById(req.user.user_id);

    const tasks = await taskService.getTasksByPerson(
      user?.username || user?.email,
    );

    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===================================
// TASK DETAILS
// ===================================

exports.getTaskDetails = async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);

    const history = await taskService.getTaskStatusHistory(req.params.id);

    const comments = await taskService.getTaskComments(req.params.id);

    res.json({
      task,
      history,
      comments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===================================
// UPDATE STATUS
// ===================================

exports.updateStatus = async (req, res) => {
  try {
    const taskId = req.params.id;

    const { status, comment } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is mandatory",
      });
    }

    console.log("UPDATE STATUS");
    console.log("TASK ID:", taskId);
    console.log("REQ USER:", req.user);
    console.log("STATUS:", status);
    console.log("COMMENT:", comment);

    const task = await taskService.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // const user = await userService.getUserById(req.user.user_id);

    // const username = user?.username || user?.email || "Unknown";
    let username = req.user.email;

    if (req.user.user_id) {
      const user = await userService.getUserById(req.user.user_id);

      username = user?.username || user?.email || req.user.email;
    }

    await taskService.updateTaskStatus(taskId, status);

    await taskService.addStatusHistory(taskId, status, username);

    await taskService.addTaskComment(taskId, comment, username);

    if (status === "Completed") {
      try {
        const history = await taskService.getTaskStatusHistory(taskId);

        const comments = await taskService.getTaskComments(taskId);

        const updatedTask = await taskService.getTaskById(taskId);

        await sendCompletionEmail(updatedTask, username, history, comments);
      } catch (err) {
        console.log(err.message);
      }
    }

    res.json({
      success: true,
      message: "Status updated",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Delete Task Controller
exports.deleteTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin only",
      });
    }

    await taskService.deleteTask(req.params.id);

    res.json({
      success: true,
      message: "Task deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
