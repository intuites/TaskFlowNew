// handlers.js
const taskService = require("../services/taskService");

const {
  sendAssignmentEmail,
  sendCompletionEmail,
} = require("../services/emailService");

const userService = require("../services/userService");
const departmentService = require("../services/departmentService");

const { authorizedCreatorIds } = require("./auth");

// const departments = ["hr", "immigration", "finance", "SD"];

const commandSuffix = "(?:@\\w+)?(?:\\s|$)";

let userState = {};
let selectedUsers = {};

const reminderOptions = [
  ["Every Minute", "minute"],
  ["Daily", "daily"],
  ["Weekly", "weekly"],
  ["Monthly", "monthly"],
  ["Quarterly", "quarterly"],
  ["Yearly", "yearly"],
  ["Custom", "custom"],
];

function cleanUsername(value) {
  return String(value || "")
    .replace("@", "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function taskLine(task, index) {
  return `${index + 1}. <b>${escapeHtml(task.person || "Unknown")}</b>
Department: ${escapeHtml(task.department || "-")}
Task: ${escapeHtml(task.task || "-")}
Status: ${task.completed ? "Done" : "Pending"}`;
}

function uniqueValues(values) {
  return [...new Set(values.map(cleanUsername).filter(Boolean))];
}

function getUserTaskName(user) {
  return (
    user?.username || user?.telegram_username || user?.name || user?.email || ""
  );
}

function getUserDepartment(user) {
  return (
    user?.department || user?.department_name || user?.department_id || "-"
  );
}

function getFirstReminderDate(frequency, customDays) {
  const next = new Date();

  switch (frequency) {
    case "minute":
      next.setMinutes(next.getMinutes() + 1);
      break;

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
      next.setDate(next.getDate() + customDays);
      break;
    default:
      throw new Error(`Unsupported reminder frequency: ${frequency}`);
  }

  return next.toISOString();
}

async function createTasksForSelection(bot, chatId, creatorId, groupId, state) {
  try {
    for (const id of state.selectedUserIds) {
      const user = await userService.getUserById(id);

      if (!user) {
        console.log("Selected user not found:", id);
        continue;
      }

      const taskPerson = getUserTaskName(user);
      const taskDepartment = getUserDepartment(user);

      console.log("Creating task...");

      const task = await taskService.createTask({
        department: taskDepartment,
        person: taskPerson,
        assigned_telegram_id: user.telegram_id || null,
        created_by_telegram_id: String(creatorId),
        chat_id: groupId,
        task: state.taskText,
        reminder_frequency: state.reminderFrequency,
        reminder_interval_days: state.customDays || null,
        next_reminder_at: getFirstReminderDate(
          state.reminderFrequency,
          state.customDays,
        ),
      });

      console.log("Task created:", task.id);

      console.log("Adding status history...");

      await taskService.addStatusHistory(task.id, "Started", "System");

      console.log("Status history added");

      await bot.sendMessage(
        groupId,
        `<b>Task Assigned</b>
Person: ${escapeHtml(taskPerson)}
Department: ${escapeHtml(taskDepartment)}
Task: ${escapeHtml(task.task)}
Reminder: ${escapeHtml(state.reminderFrequency)}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Status",
                  callback_data: `status_${task.id}`,
                },
                // {
                //   text: "Comment",
                //   callback_data: `comment_${task.id}`,
                // },
              ],
            ],
          },
        },
      );

      if (user.email) {
        try {
          await sendAssignmentEmail(user.email, task);
          console.log("Assignment email sent:", user.email);
        } catch (error) {
          console.log("Assignment email error:", error.message);
        }
      }
    }

    await bot.sendMessage(chatId, "Task created for selected users!");

    delete userState[creatorId];
    delete selectedUsers[creatorId];
  } catch (error) {
    console.error("CREATE TASK ERROR:", JSON.stringify(error, null, 2));

    console.error(error);

    await bot.sendMessage(chatId, "Task creation failed. Check server logs.");
  }
}

async function getMessageUserTaskNames(msg) {
  const names = [msg.from.username, msg.from.first_name];

  try {
    const user = await userService.getUserByTelegramId(msg.from.id);

    const taskName = getUserTaskName(user);

    if (taskName) {
      names.push(taskName);
    }
  } catch (error) {
    console.error(
      "Failed to find user by Telegram ID:",
      msg.from.id,
      formatError(error),
    );
  }

  return uniqueValues(names);
}

function getUserTasks(tasks, completed) {
  return tasks.filter((task) => Boolean(task.completed) === completed);
}

async function getTasksForMessageUser(msg, completed) {
  const [idTasks, taskNames] = await Promise.all([
    taskService.getTasksByTelegramId(msg.from.id),
    getMessageUserTaskNames(msg),
  ]);

  const nameTaskLists = await Promise.all(
    taskNames.map(async (name) => {
      try {
        return await taskService.getTasksByPerson(name);
      } catch (error) {
        console.error(
          "Failed to load tasks for user:",
          name,
          formatError(error),
        );
        return [];
      }
    }),
  );

  const tasksById = new Map();

  for (const task of [idTasks, ...nameTaskLists].flat()) {
    tasksById.set(task.id, task);
  }

  const tasks = [...tasksById.values()].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );

  return getUserTasks(tasks, completed);
}

async function sendMyPendingTasks(bot, msg, tasks) {
  await bot.sendMessage(msg.chat.id, `<b>My Tasks (${tasks.length})</b>`, {
    parse_mode: "HTML",
  });

  for (const task of tasks) {
    await bot.sendMessage(
      msg.chat.id,
      `<b>Task</b>
Department: ${escapeHtml(task.department || "-")}
Task: ${escapeHtml(task.task || "-")}
Status: Pending`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Status",
                callback_data: `status_${task.id}`,
              },
              // {
              //   text: "Comment",
              //   callback_data: `comment_${task.id}`,
              // },
            ],
          ],
        },
      },
    );
  }
}

//new ,,,.

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(date) {
  if (!date) return "-";

  const d = new Date(date);

  return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
}

function generateCalendar(year, month, state = {}) {
  const keyboard = [];

  keyboard.push([
    {
      text: "<",
      callback_data: `cal_prev_${year}_${month}`,
    },
    {
      text: `${monthNames[month]} ${year}`,
      callback_data: "ignore",
    },
    {
      text: ">",
      callback_data: `cal_next_${year}_${month}`,
    },
  ]);

  keyboard.push([
    { text: "Mo", callback_data: "ignore" },
    { text: "Tu", callback_data: "ignore" },
    { text: "We", callback_data: "ignore" },
    { text: "Th", callback_data: "ignore" },
    { text: "Fr", callback_data: "ignore" },
    { text: "Sa", callback_data: "ignore" },
    { text: "Su", callback_data: "ignore" },
  ]);

  const firstDay = new Date(year, month, 1).getDay();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let row = [];

  let startDay = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < startDay; i++) {
    row.push({
      text: " ",
      callback_data: "ignore",
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = `${year}-${month}-${day}`;

    let label = `${day}`;

    if (state.fromDate === currentDate) {
      label = `🟢 ${day}`;
    }

    if (state.toDate === currentDate) {
      label = `🔵 ${day}`;
    }

    row.push({
      text: label,
      callback_data: `date_${year}_${month}_${day}`,
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  while (row.length < 7 && row.length !== 0) {
    row.push({
      text: " ",
      callback_data: "ignore",
    });
  }

  if (row.length) {
    keyboard.push(row);
  }

  keyboard.push([
    {
      text: "Pick From",
      callback_data: "pick_from",
    },
    {
      text: "Pick To",
      callback_data: "pick_to",
    },
  ]);

  keyboard.push([
    {
      text: "Clear",
      callback_data: "clear_dates",
    },
  ]);

  keyboard.push([
    {
      text: "Cancel",
      callback_data: "cancel_calendar",
    },
  ]);

  return {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

function getCalendarText(state = {}) {
  return `
<b>Select Date Range</b>

Step: ${state.selectionMode === "to" ? "To Date" : "From Date"}

From: ${formatDate(state.fromDate)}
To: ${formatDate(state.toDate)}

Tap dates from calendar.
`;
}

function registerHandlers(bot, GROUP_IDS) {
  bot.onText(new RegExp(`^/start${commandSuffix}`), (msg) => {
    // const commands = [
    //   "/addtask",
    //   ...(authorizedCreatorIds.includes(msg.from.id) ? ["/tasks"] : []),
    //   "/mytasks",
    //   "/completedtasks",
    //   "/myid",
    // ];
    const commands = [
      "/addtask",
      "/mytasks",
      "/completedtasks",
      "/myid",

      // ...(authorizedCreatorIds.includes(msg.from.id)
      //   ? ["/tasks", "/adduser", "/deleteuser", "/listusers"]
      //   : []),
      ...(authorizedCreatorIds.includes(msg.from.id)
        ? [
            "/tasks",
            "/adduser",
            "/deleteuser",
            "/listusers",
            "/adddepartment",
            "/departments",
            "/updatedepartment",
            "/deletedepartment",
          ]
        : []),
    ];

    return bot.sendMessage(
      msg.chat.id,
      `Bot Ready\nCommands:\n${commands.join("\n")}`,
    );
  });

  //
  //add department
  bot.onText(/\/adddepartment/, async (msg) => {
    if (!authorizedCreatorIds.includes(msg.from.id)) {
      return;
    }

    userState[msg.from.id] = {
      stage: "add_department",
    };

    bot.sendMessage(msg.chat.id, "Enter Department Name:");
  });

  bot.onText(new RegExp(`^/myid${commandSuffix}`), (msg) => {
    return bot.sendMessage(msg.chat.id, `Your Telegram ID: ${msg.from.id}`);
  });
  // Add tasks Previous orders commented to change the preference

  // bot.onText(new RegExp(`^/addtask${commandSuffix}`), async (msg) => {
  //   const userId = msg.from.id;

  //   if (!authorizedCreatorIds.includes(userId)) {
  //     return bot.sendMessage(msg.chat.id, "Not authorized");
  //   }
  //   const deptRows = await departmentService.getDepartments();

  //   const keyboard = deptRows.map((d) => [
  //     {
  //       text: d.name,
  //       callback_data: `dep_${d.name}`,
  //     },
  //   ]);

  //   selectedUsers[userId] = [];
  //   delete userState[userId];

  //   return bot.sendMessage(msg.chat.id, "Select Department:", {
  //     reply_markup: { inline_keyboard: keyboard },
  //   });
  // });

  bot.onText(new RegExp(`^/addtask${commandSuffix}`), async (msg) => {
    const userId = msg.from.id;

    if (!authorizedCreatorIds.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    selectedUsers[userId] = [];

    userState[userId] = {
      stage: "task_name",
      groupId: msg.chat.id,
    };

    return bot.sendMessage(msg.chat.id, "Enter Task Name:");
  });

  // Delete users

  bot.onText(new RegExp(`^/deleteuser${commandSuffix}`), async (msg) => {
    const userId = msg.from.id;

    if (!authorizedCreatorIds.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const deptRows = await departmentService.getDepartments();

    const keyboard = deptRows.map((dep) => [
      {
        text: dep.name,
        callback_data: `deldep_${dep.name}`,
      },
    ]);

    return bot.sendMessage(msg.chat.id, "Select Department:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });

  // List Users

  bot.onText(new RegExp(`^/listusers${commandSuffix}`), async (msg) => {
    if (!authorizedCreatorIds.includes(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const deptRows = await departmentService.getDepartments();

    const keyboard = deptRows.map((dep) => [
      {
        text: dep.name,
        callback_data: `listusers_${dep.name}`,
      },
    ]);

    return bot.sendMessage(msg.chat.id, "Select Department:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });

  // //add User
  // bot.onText(new RegExp(`^/adduser${commandSuffix}`), (msg) => {
  //   const userId = msg.from.id;

  //   if (!authorizedCreatorIds.includes(userId)) {
  //     return bot.sendMessage(msg.chat.id, "Not authorized");
  //   }

  //   const keyboard = deptRows.map((dep) => [
  //     {
  //       text: dep,
  //       callback_data: `adduserdep_${dep}`,
  //     },
  //   ]);

  //   userState[userId] = {
  //     stage: "select_user_department",
  //   };

  //   return bot.sendMessage(msg.chat.id, "Select Department:", {
  //     reply_markup: {
  //       inline_keyboard: keyboard,
  //     },
  //   });
  // });
  bot.onText(new RegExp(`^/adduser${commandSuffix}`), async (msg) => {
    const userId = msg.from.id;

    if (!authorizedCreatorIds.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const deptRows = await departmentService.getDepartments();

    if (!deptRows.length) {
      return bot.sendMessage(
        msg.chat.id,
        "No departments found. Create one using /adddepartment",
      );
    }

    const keyboard = deptRows.map((dep) => [
      {
        text: dep.name,
        callback_data: `adduserdep_${dep.name}`,
      },
    ]);

    userState[userId] = {
      stage: "select_user_department",
    };

    return bot.sendMessage(msg.chat.id, "Select Department:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });

  // updatedepartment
  bot.onText(/\/updatedepartment/, async (msg) => {
    if (!authorizedCreatorIds.includes(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const departments = await departmentService.getDepartments();

    const keyboard = departments.map((d) => [
      {
        text: d.name,
        callback_data: `editdept_${d.id}`,
      },
    ]);

    return bot.sendMessage(msg.chat.id, "Select Department To Update:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });

  bot.onText(/\/deletedepartment/, async (msg) => {
    if (!authorizedCreatorIds.includes(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const departments = await departmentService.getDepartments();

    const keyboard = departments.map((d) => [
      {
        text: d.name,
        callback_data: `deletedept_${d.id}`,
      },
    ]);

    return bot.sendMessage(msg.chat.id, "Select Department To Delete:", {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  });
  //

  // /adddepartment
  bot.onText(/\/departments/, async (msg) => {
    const departments = await departmentService.getDepartments();

    if (!departments.length) {
      return bot.sendMessage(msg.chat.id, "No departments found");
    }

    const text = departments.map((d, i) => `${i + 1}. ${d.name}`).join("\n");

    bot.sendMessage(msg.chat.id, `📂 Departments\n\n${text}`);
  });
  // //

  bot.onText(new RegExp(`^/tasks${commandSuffix}`), async (msg) => {
    const userId = msg.from.id;

    if (!authorizedCreatorIds.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "Not authorized");
    }

    const tasks = await taskService.getAllTasks();

    if (!tasks.length) {
      return bot.sendMessage(msg.chat.id, "No tasks");
    }

    return bot.sendMessage(
      msg.chat.id,
      `<b>Tasks</b>\n\n${tasks.map(taskLine).join("\n\n")}`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(new RegExp(`^/mytasks${commandSuffix}`), async (msg) => {
    try {
      const tasks = await getTasksForMessageUser(msg, false);

      if (!tasks.length) {
        return bot.sendMessage(msg.chat.id, "No pending tasks assigned to you");
      }

      return sendMyPendingTasks(bot, msg, tasks);
    } catch (error) {
      console.error("/mytasks failed:", formatError(error));
      return bot.sendMessage(
        msg.chat.id,
        "Could not load your pending tasks. Please try again.",
      );
    }
  });

  bot.onText(new RegExp(`^/completedtasks?${commandSuffix}`), async (msg) => {
    try {
      const tasks = await getTasksForMessageUser(msg, true);

      if (!tasks.length) {
        return bot.sendMessage(msg.chat.id, "No completed tasks for you");
      }

      return bot.sendMessage(
        msg.chat.id,
        `<b>Completed Tasks (${tasks.length})</b>\n\n${tasks
          .map(taskLine)
          .join("\n\n")}`,
        { parse_mode: "HTML" },
      );
    } catch (error) {
      console.error("/completedtasks failed:", formatError(error));
      return bot.sendMessage(
        msg.chat.id,
        "Could not load your completed tasks. Please try again.",
      );
    }
  });

  //

  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const userId = q.from.id;
    const data = q.data || "";

    // ================= CALENDAR =================

    // PREVIOUS MONTH
    if (data.startsWith("cal_prev_")) {
      const [, , year, month] = data.split("_");

      let y = Number(year);
      let m = Number(month) - 1;

      if (m < 0) {
        m = 11;
        y--;
      }

      userState[userId].calendarYear = y;
      userState[userId].calendarMonth = m;

      return bot.editMessageText(getCalendarText(userState[userId]), {
        chat_id: chatId,
        message_id: q.message.message_id,
        ...generateCalendar(y, m, userState[userId]),
      });
    }

    // NEXT MONTH
    if (data.startsWith("cal_next_")) {
      const [, , year, month] = data.split("_");

      let y = Number(year);
      let m = Number(month) + 1;

      if (m > 11) {
        m = 0;
        y++;
      }

      userState[userId].calendarYear = y;
      userState[userId].calendarMonth = m;

      return bot.editMessageText(getCalendarText(userState[userId]), {
        chat_id: chatId,
        message_id: q.message.message_id,
        ...generateCalendar(y, m, userState[userId]),
      });
    }

    // PICK FROM
    if (data === "pick_from") {
      userState[userId].selectionMode = "from";

      return bot.answerCallbackQuery(q.id, {
        text: "Select FROM date",
      });
    }

    // PICK TO
    if (data === "pick_to") {
      userState[userId].selectionMode = "to";

      return bot.answerCallbackQuery(q.id, {
        text: "Select TO date",
      });
    }

    // SELECT DATE
    if (data.startsWith("date_")) {
      const [, year, month, day] = data.split("_");

      const selectedDate = `${year}-${month}-${day}`;

      if (userState[userId].selectionMode === "from") {
        userState[userId].fromDate = selectedDate;
      } else {
        userState[userId].toDate = selectedDate;
      }

      const y = userState[userId].calendarYear;
      const m = userState[userId].calendarMonth;

      // BOTH DATES SELECTED
      if (userState[userId].fromDate && userState[userId].toDate) {
        const from = new Date(userState[userId].fromDate);

        const to = new Date(userState[userId].toDate);

        const diffTime = to.getTime() - from.getTime();

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 1) {
          return bot.answerCallbackQuery(q.id, {
            text: "To date must be after From date",
            show_alert: true,
          });
        }

        userState[userId].customDays = diffDays;

        return createTasksForSelection(
          bot,
          chatId,
          userId,
          userState[userId].groupId,
          userState[userId],
        );
      }

      return bot.editMessageText(getCalendarText(userState[userId]), {
        chat_id: chatId,
        message_id: q.message.message_id,
        ...generateCalendar(y, m, userState[userId]),
      });
    }

    // CLEAR DATES
    if (data === "clear_dates") {
      userState[userId].fromDate = null;
      userState[userId].toDate = null;

      return bot.editMessageText(getCalendarText(userState[userId]), {
        chat_id: chatId,
        message_id: q.message.message_id,
        ...generateCalendar(
          userState[userId].calendarYear,
          userState[userId].calendarMonth,
          userState[userId],
        ),
      });
    }

    // CANCEL
    if (data === "cancel_calendar") {
      delete userState[userId];

      return bot.deleteMessage(chatId, q.message.message_id);
    }

    // ================Update status========================
    // if (data.startsWith("setstatus_")) {
    //   const parts = data.split("_");

    //   const taskId = parts[1];
    //   const status = parts[2];
    //   const task = await taskService.getTaskById(taskId);

    //   if (!task) {
    //     return bot.answerCallbackQuery(q.id, {
    //       text: "Task not found",
    //       show_alert: true,
    //     });
    //   }

    //   await taskService.updateTaskStatus(taskId, status);

    //   // await taskService.addStatusHistory(
    //   //   taskId,
    //   //   status,
    //   //   q.from.username || q.from.first_name,
    //   // );

    //   return bot.answerCallbackQuery(q.id, {
    //     text: `Status updated to ${status}`,
    //   });
    // }

    if (data.startsWith("setstatus_")) {
      const parts = data.split("_");

      const taskId = parts[1];
      const status = parts[2];

      userState[userId] = {
        stage: "ask_comment",
        taskId,
        status,
      };

      return bot.sendMessage(
        chatId,
        `You selected "${status}".\n\nDo you want to add a comment?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Yes",
                  callback_data: "comment_yes",
                },
                {
                  text: "❌ No",
                  callback_data: "comment_no",
                },
              ],
            ],
          },
        },
      );
    }

    // ==================Update Department from table
    if (data.startsWith("editdept_")) {
      const deptId = data.replace("editdept_", "");

      userState[userId] = {
        stage: "rename_department",
        departmentId: deptId,
      };

      return bot.sendMessage(chatId, "Enter New Department Name:");
    }

    // ================= COMMENT YES =================

    if (data === "comment_yes") {
      userState[userId].stage = "status_comment";

      return bot.sendMessage(chatId, "Enter your comment:");
    }

    // ================= COMMENT NO =================

    if (data === "comment_no") {
      const state = userState[userId];

      const task = await taskService.getTaskById(state.taskId);

      if (!task) {
        delete userState[userId];
        return bot.sendMessage(chatId, "Task not found");
      }

      await taskService.updateTaskStatus(state.taskId, state.status);

      await taskService.addStatusHistory(
        state.taskId,
        state.status,
        q.from.username || q.from.first_name,
      );

      if (state.status === "Completed") {
        try {
          const updatedTask = await taskService.getTaskById(state.taskId);

          const history = await taskService.getTaskStatusHistory(state.taskId);

          const comments = await taskService.getTaskComments(state.taskId);

          await sendCompletionEmail(
            updatedTask,
            q.from.username || q.from.first_name,
            history,
            comments,
          );
        } catch (err) {
          console.log(err.message);
        }
      }

      delete userState[userId];

      return bot.sendMessage(chatId, `✅ Status updated to "${state.status}".`);
    }

    // ==================Update Department from table
    if (data.startsWith("deletedept_")) {
      const deptId = data.replace("deletedept_", "");

      await departmentService.deleteDepartment(deptId);

      return bot.sendMessage(chatId, "✅ Department deleted successfully");
    }
    // ==================Delete User by Department ===================

    if (data.startsWith("deldep_")) {
      const department = data.replace("deldep_", "");

      const users = await userService.getUsersByDepartment(department);

      if (!users.length) {
        return bot.sendMessage(chatId, "No users found");
      }

      const keyboard = users.map((u) => [
        {
          text: `${u.username || u.email}`,
          callback_data: `deleteuser_${u.id}`,
        },
      ]);

      return bot.sendMessage(chatId, "Select User To Delete:", {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    }
    // ===================Add User===============
    if (data.startsWith("adduserdep_")) {
      const department = data.replace("adduserdep_", "");

      userState[userId] = {
        stage: "adduser_username",
        department,
      };

      return bot.sendMessage(
        chatId,
        `Department: ${department}

Enter Username:`,
      );
    }
    // ==========List Users====================
    if (data.startsWith("listusers_")) {
      const department = data.replace("listusers_", "");

      const users = await userService.getUsersByDepartment(department);

      if (!users.length) {
        return bot.sendMessage(chatId, "No users found");
      }

      const message = users
        .map(
          (u, i) =>
            `${i + 1}. ${u.username}
Email: ${u.email}
Telegram: ${u.telegram_id}`,
        )
        .join("\n\n");

      return bot.sendMessage(
        chatId,
        `<b>${department.toUpperCase()} Users</b>

${message}`,
        {
          parse_mode: "HTML",
        },
      );
    }

    // =========For Delete only===================
    if (data.startsWith("deleteuser_")) {
      const userDbId = data.replace("deleteuser_", "");

      const user = await userService.getUserById(userDbId);

      if (!user) {
        return bot.answerCallbackQuery(q.id, {
          text: "User not found",
          show_alert: true,
        });
      }

      return bot.sendMessage(chatId, `Delete ${user.username || user.email}?`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Yes",
                callback_data: `confirmdelete_${userDbId}`,
              },
              {
                text: "❌ No",
                callback_data: "canceldelete",
              },
            ],
          ],
        },
      });
    }

    // =============Confirm Delete================
    if (data.startsWith("confirmdelete_")) {
      const userDbId = data.replace("confirmdelete_", "");

      await userService.deleteUser(userDbId);

      await bot.answerCallbackQuery(q.id, {
        text: "User deleted",
      });

      return bot.sendMessage(chatId, "✅ User deleted successfully");
    }

    // ==============Cancel Delete ===========================
    if (data === "canceldelete") {
      return bot.answerCallbackQuery(q.id, {
        text: "Cancelled",
      });
    }

    // ================= Comment Button TASK =================
    if (data.startsWith("comment_")) {
      const taskId = data.replace("comment_", "");

      userState[userId] = {
        stage: "comment",
        taskId,
      };

      return bot.sendMessage(chatId, "Enter your comment:");
    }

    // ================= Status Button TASK =================
    if (data.startsWith("status_")) {
      const taskId = data.replace("status_", "");

      return bot.sendMessage(chatId, "Select Status", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Started",
                callback_data: `setstatus_${taskId}_Started`,
              },
            ],
            [
              {
                text: "Pending",
                callback_data: `setstatus_${taskId}_Pending`,
              },
            ],
            [
              {
                text: "Completed",
                callback_data: `setstatus_${taskId}_Completed`,
              },
            ],
          ],
        },
      });
    }

    // ================= COMPLETE TASK =================

    if (data.startsWith("complete_")) {
      const [, taskId, telegramId] = data.split("_");

      const task = await taskService.getTaskById(taskId);

      const clickedUsername = cleanUsername(
        q.from.username || q.from.first_name,
      );

      const assignedUsername = cleanUsername(task?.person);

      const idMatches =
        String(q.from.id).trim() === String(telegramId || "").trim();

      const usernameMatches =
        assignedUsername && clickedUsername === assignedUsername;

      if (!task) {
        return bot.answerCallbackQuery(q.id, {
          text: "Task not found",
          show_alert: true,
        });
      }

      // NEW CHECK
      if (task.completed) {
        return bot.answerCallbackQuery(q.id, {
          text: "Task already completed",
          show_alert: true,
        });
      }

      if (!idMatches && !usernameMatches) {
        return bot.answerCallbackQuery(q.id, {
          text: "Only assigned user can complete",
          show_alert: true,
        });
      }

      await taskService.completeTask(taskId);

      try {
        const updatedTask = await taskService.getTaskById(taskId);

        await sendCompletionEmail(
          updatedTask,
          q.from.username || q.from.first_name,
        );

        console.log("✅ Completion email sent");
      } catch (error) {
        console.log("❌ Completion email failed:", error.message);
      }

      await bot.answerCallbackQuery(q.id, {
        text: "Task completed",
      });

      return bot.sendMessage(chatId, "Task completed");
    }

    // ================= AUTH CHECK =================

    if (!authorizedCreatorIds.includes(userId)) {
      return bot.answerCallbackQuery(q.id, {
        text: "Not allowed",
        show_alert: true,
      });
    }

    // ================= DEPARTMENT SELECT =================

    if (data.startsWith("dep_")) {
      const department = data.replace("dep_", "").trim().toLowerCase();
      userState[userId] = {
        ...userState[userId],
        department,
        stage: "select_users",
      };

      const users = await userService.getUsersByDepartment(department);

      if (!users || users.length === 0) {
        return bot.sendMessage(chatId, "No users found");
      }

      selectedUsers[userId] = [];

      const keyboard = users.map((user) => [
        {
          text: getUserTaskName(user),
          callback_data: `user_${user.id}`,
        },
      ]);

      keyboard.push([
        {
          text: "Done",
          callback_data: "done_users",
        },
      ]);

      return bot.sendMessage(chatId, "Select Users:", {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    }

    // ================= SELECT USER =================

    if (data.startsWith("user_")) {
      const selectedUserId = data.replace("user_", "");

      if (!selectedUsers[userId]) {
        selectedUsers[userId] = [];
      }

      if (!selectedUsers[userId].includes(selectedUserId)) {
        selectedUsers[userId].push(selectedUserId);
      }

      return bot.answerCallbackQuery(q.id, {
        text: "Added",
      });
    }

    // ================= DONE USERS =================

    if (data === "done_users") {
      if (!selectedUsers[userId]?.length) {
        return bot.sendMessage(chatId, "Select at least one user");
      }

      userState[userId] = {
        ...userState[userId],
        selectedUserIds: selectedUsers[userId],
        groupId: chatId,
        stage: "reminder",
      };

      const keyboard = reminderOptions.map(([label, value]) => [
        {
          text: label,
          callback_data: `reminder_${value}`,
        },
      ]);

      return bot.sendMessage(chatId, "Select Reminder Frequency:", {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    }
    // ================= REMINDER =================

    if (data.startsWith("reminder_")) {
      const frequency = data.replace("reminder_", "");

      const validFrequency = reminderOptions.some(
        ([, value]) => value === frequency,
      );

      if (!validFrequency || !userState[userId]?.taskText) {
        return bot.answerCallbackQuery(q.id, {
          text: "Task setup expired. Start again.",
          show_alert: true,
        });
      }

      userState[userId].reminderFrequency = frequency;

      // CUSTOM CALENDAR
      if (frequency === "custom") {
        const now = new Date();

        userState[userId].stage = "calendar";

        userState[userId].selectionMode = "from";

        userState[userId].calendarYear = now.getFullYear();

        userState[userId].calendarMonth = now.getMonth();

        userState[userId].fromDate = null;
        userState[userId].toDate = null;

        await bot.answerCallbackQuery(q.id);

        return bot.sendMessage(
          chatId,
          getCalendarText(userState[userId]),
          generateCalendar(
            now.getFullYear(),
            now.getMonth(),
            userState[userId],
          ),
        );
      }

      await bot.answerCallbackQuery(q.id, {
        text: `${frequency} selected`,
      });

      return createTasksForSelection(
        bot,
        chatId,
        userId,
        // GROUP_ID,
        userState[userId].groupId,
        userState[userId],
      );
    }
  });

  //

  // ✅ CREATE TASK
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || "";

    // if (
    //   !authorizedCreatorIds.includes(userId) &&
    //   userState[userId]?.stage !== "comment"
    // ) {
    //   return;
    // }

    if (!authorizedCreatorIds.includes(userId)) {
      const allowedStages = ["comment"];

      if (!allowedStages.includes(userState[userId]?.stage)) {
        return;
      }
    }

    if (!userState[userId] || text.startsWith("/")) return;

    const state = userState[userId];

    // ================Add Department==============
    if (state.stage === "add_department") {
      try {
        await departmentService.createDepartment(text.trim());

        await bot.sendMessage(chatId, `✅ Department Added\n\n${text}`);

        delete userState[userId];
      } catch (err) {
        await bot.sendMessage(chatId, err.message);
      }

      return;
    }

    //
    // Rename Department
    if (state.stage === "rename_department") {
      await departmentService.updateDepartment(state.departmentId, text.trim());

      await bot.sendMessage(chatId, `✅ Department renamed to ${text}`);

      delete userState[userId];
      return;
    }

    // ================= ADD USER =================

    // Username
    if (state.stage === "adduser_username") {
      state.username = text.trim();
      state.stage = "adduser_email";

      return bot.sendMessage(chatId, "Enter Email:");
    }

    // Email
    if (state.stage === "adduser_email") {
      state.email = text.trim();
      state.stage = "adduser_telegram";

      return bot.sendMessage(chatId, "Enter Telegram ID:");
    }

    // Telegram ID + Save
    if (state.stage === "adduser_telegram") {
      state.telegram_id = text.trim();

      await userService.createUser({
        username: state.username,
        email: state.email,
        telegram_id: state.telegram_id,
        department: state.department,
      });

      await bot.sendMessage(
        chatId,
        `✅ User Added

Username: ${state.username}
Email: ${state.email}
Department: ${state.department}
Telegram ID: ${state.telegram_id}`,
      );

      delete userState[userId];

      return;
    }

    // This block of code for status and commentent mandatory
    // if (state.stage === "status_comment") {
    //   const comment = text.trim();

    //   if (!comment) {
    //     return bot.sendMessage(chatId, "Comment is mandatory.");
    //   }

    //   const task = await taskService.getTaskById(state.taskId);

    //   if (!task) {
    //     delete userState[userId];

    //     return bot.sendMessage(chatId, "Task not found");
    //   }

    //   // Save status
    //   await taskService.updateTaskStatus(state.taskId, state.status);

    //   // Save status history
    //   await taskService.addStatusHistory(
    //     state.taskId,
    //     state.status,
    //     msg.from.username || msg.from.first_name,
    //   );

    //   // Save mandatory comment
    //   await taskService.addTaskComment(
    //     state.taskId,
    //     comment,
    //     msg.from.username || msg.from.first_name,
    //   );

    //   // Completed email
    //   if (state.status === "Completed") {
    //     try {
    //       const updatedTask = await taskService.getTaskById(state.taskId);

    //       const history = await taskService.getTaskStatusHistory(state.taskId);

    //       const comments = await taskService.getTaskComments(state.taskId);

    //       await sendCompletionEmail(
    //         updatedTask,
    //         msg.from.username || msg.from.first_name,
    //         history,
    //         comments,
    //       );
    //     } catch (error) {
    //       console.log("Completion email failed:", error.message);
    //     }
    //   }

    //   await bot.sendMessage(
    //     chatId,
    //     `✅ Status updated to "${state.status}" and comment saved.`,
    //   );

    //   delete userState[userId];

    //   return;
    // }
    // to change the preference task creation added this

    // This block of code staus should be there but comment is optional
    if (state.stage === "status_comment") {
      const comment = text.trim();

      const task = await taskService.getTaskById(state.taskId);

      if (!task) {
        delete userState[userId];

        return bot.sendMessage(chatId, "Task not found");
      }

      // Save status
      await taskService.updateTaskStatus(state.taskId, state.status);

      // Save status history
      await taskService.addStatusHistory(
        state.taskId,
        state.status,
        msg.from.username || msg.from.first_name,
      );

      // Save comment ONLY if provided
      if (comment) {
        await taskService.addTaskComment(
          state.taskId,
          comment,
          msg.from.username || msg.from.first_name,
        );
      }

      // Send completion email if completed
      if (state.status === "Completed") {
        try {
          const updatedTask = await taskService.getTaskById(state.taskId);

          const history = await taskService.getTaskStatusHistory(state.taskId);

          const comments = await taskService.getTaskComments(state.taskId);

          await sendCompletionEmail(
            updatedTask,
            msg.from.username || msg.from.first_name,
            history,
            comments,
          );
        } catch (error) {
          console.log("Completion email failed:", error.message);
        }
      }

      await bot.sendMessage(chatId, `✅ Status updated to "${state.status}".`);

      delete userState[userId];

      return;
    }

    // ================= TASK NAME FIRST =================

    if (state.stage === "task_name") {
      state.taskText = text.trim();

      const deptRows = await departmentService.getDepartments();

      const keyboard = deptRows.map((d) => [
        {
          text: d.name,
          callback_data: `dep_${d.name}`,
        },
      ]);

      state.stage = "select_department";

      return bot.sendMessage(chatId, "Select Department:", {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    }

    // if (state.stage !== "reminder") {
    //   state.taskText = text.trim();
    //   state.stage = "reminder";

    //   const keyboard = reminderOptions.map(([label, value]) => [
    //     { text: label, callback_data: `reminder_${value}` },
    //   ]);

    //   return bot.sendMessage(chatId, "Select Reminder Frequency:", {
    //     reply_markup: { inline_keyboard: keyboard },
    //   });
    // }

    if (state.stage === "reminder") {
      return bot.sendMessage(chatId, "Select a reminder option above.");
    }

    // return bot.sendMessage(chatId, "Select a reminder option above.");
    /*

      // ✅ SEND EMAIL
      if (user.email) {
        try {
          await sendAssignmentEmail(user.email, task);

          console.log("✅ Email sent to:", user.email);
        } catch (error) {
          console.log("❌ Email error:", error.message);
        }
      }
    }

    await bot.sendMessage(chatId, "Task created for selected users!");

    delete userState[userId];
    delete selectedUsers[userId];
    */
  });
}

module.exports = registerHandlers;
// -------------------------------------------------------------------------------------------------------
//........Working Perfectly
// handlers.js
// const taskService = require("../services/taskService");

// const {
//   sendAssignmentEmail,
//   sendCompletionEmail,
// } = require("../services/emailService");

// const userService = require("../services/userService");

// const { authorizedCreatorIds } = require("./auth");

// const departments = ["hr", "immigration", "finance", "SD"];

// const commandSuffix = "(?:@\\w+)?(?:\\s|$)";

// let userState = {};
// let selectedUsers = {};

// const reminderOptions = [
//   ["Every Minute", "minute"],
//   ["Daily", "daily"],
//   ["Weekly", "weekly"],
//   ["Monthly", "monthly"],
//   ["Quarterly", "quarterly"],
//   ["Yearly", "yearly"],
//   ["Custom", "custom"],
// ];

// function cleanUsername(value) {
//   return String(value || "")
//     .replace("@", "")
//     .trim()
//     .toLowerCase();
// }

// function escapeHtml(value) {
//   return String(value || "")
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

// function formatError(error) {
//   if (error instanceof Error) {
//     return error.stack || error.message;
//   }

//   try {
//     return JSON.stringify(error);
//   } catch {
//     return String(error);
//   }
// }

// function taskLine(task, index) {
//   return `${index + 1}. <b>${escapeHtml(task.person || "Unknown")}</b>
// Department: ${escapeHtml(task.department || "-")}
// Task: ${escapeHtml(task.task || "-")}
// Status: ${task.completed ? "Done" : "Pending"}`;
// }

// function uniqueValues(values) {
//   return [...new Set(values.map(cleanUsername).filter(Boolean))];
// }

// function getUserTaskName(user) {
//   return (
//     user?.username || user?.telegram_username || user?.name || user?.email || ""
//   );
// }

// function getUserDepartment(user) {
//   return (
//     user?.department || user?.department_name || user?.department_id || "-"
//   );
// }

// function getFirstReminderDate(frequency, customDays) {
//   const next = new Date();

//   switch (frequency) {
//     case "minute":
//       next.setMinutes(next.getMinutes() + 1);
//       break;

//     case "daily":
//       next.setDate(next.getDate() + 1);
//       break;
//     case "weekly":
//       next.setDate(next.getDate() + 7);
//       break;
//     case "monthly":
//       next.setMonth(next.getMonth() + 1);
//       break;
//     case "quarterly":
//       next.setMonth(next.getMonth() + 3);
//       break;
//     case "yearly":
//       next.setFullYear(next.getFullYear() + 1);
//       break;
//     case "custom":
//       next.setDate(next.getDate() + customDays);
//       break;
//     default:
//       throw new Error(`Unsupported reminder frequency: ${frequency}`);
//   }

//   return next.toISOString();
// }

// async function createTasksForSelection(bot, chatId, creatorId, groupId, state) {
//   try {
//     for (const id of state.selectedUserIds) {
//       const user = await userService.getUserById(id);

//       if (!user) {
//         console.log("Selected user not found:", id);
//         continue;
//       }

//       const taskPerson = getUserTaskName(user);
//       const taskDepartment = getUserDepartment(user);

//       console.log("Creating task...");

//       const task = await taskService.createTask({
//         department: taskDepartment,
//         person: taskPerson,
//         assigned_telegram_id: user.telegram_id || null,
//         created_by_telegram_id: String(creatorId),
//         chat_id: groupId,
//         task: state.taskText,
//         reminder_frequency: state.reminderFrequency,
//         reminder_interval_days: state.customDays || null,
//         next_reminder_at: getFirstReminderDate(
//           state.reminderFrequency,
//           state.customDays,
//         ),
//       });

//       console.log("Task created:", task.id);

//       console.log("Adding status history...");

//       await taskService.addStatusHistory(task.id, "Pending", "System");

//       console.log("Status history added");

//       await bot.sendMessage(
//         groupId,
//         `<b>Task Assigned</b>
// Person: ${escapeHtml(taskPerson)}
// Department: ${escapeHtml(taskDepartment)}
// Task: ${escapeHtml(task.task)}
// Reminder: ${escapeHtml(state.reminderFrequency)}`,
//         {
//           parse_mode: "HTML",
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 {
//                   text: "Status",
//                   callback_data: `status_${task.id}`,
//                 },
//                 {
//                   text: "Comment",
//                   callback_data: `comment_${task.id}`,
//                 },
//               ],
//             ],
//           },
//         },
//       );

//       if (user.email) {
//         try {
//           await sendAssignmentEmail(user.email, task);
//           console.log("Assignment email sent:", user.email);
//         } catch (error) {
//           console.log("Assignment email error:", error.message);
//         }
//       }
//     }

//     await bot.sendMessage(chatId, "Task created for selected users!");

//     delete userState[creatorId];
//     delete selectedUsers[creatorId];
//   } catch (error) {
//     console.error("CREATE TASK ERROR:", JSON.stringify(error, null, 2));

//     console.error(error);

//     await bot.sendMessage(chatId, "Task creation failed. Check server logs.");
//   }
// }

// async function getMessageUserTaskNames(msg) {
//   const names = [msg.from.username, msg.from.first_name];

//   try {
//     const user = await userService.getUserByTelegramId(msg.from.id);

//     const taskName = getUserTaskName(user);

//     if (taskName) {
//       names.push(taskName);
//     }
//   } catch (error) {
//     console.error(
//       "Failed to find user by Telegram ID:",
//       msg.from.id,
//       formatError(error),
//     );
//   }

//   return uniqueValues(names);
// }

// function getUserTasks(tasks, completed) {
//   return tasks.filter((task) => Boolean(task.completed) === completed);
// }

// async function getTasksForMessageUser(msg, completed) {
//   const [idTasks, taskNames] = await Promise.all([
//     taskService.getTasksByTelegramId(msg.from.id),
//     getMessageUserTaskNames(msg),
//   ]);

//   const nameTaskLists = await Promise.all(
//     taskNames.map(async (name) => {
//       try {
//         return await taskService.getTasksByPerson(name);
//       } catch (error) {
//         console.error(
//           "Failed to load tasks for user:",
//           name,
//           formatError(error),
//         );
//         return [];
//       }
//     }),
//   );

//   const tasksById = new Map();

//   for (const task of [idTasks, ...nameTaskLists].flat()) {
//     tasksById.set(task.id, task);
//   }

//   const tasks = [...tasksById.values()].sort(
//     (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
//   );

//   return getUserTasks(tasks, completed);
// }

// async function sendMyPendingTasks(bot, msg, tasks) {
//   await bot.sendMessage(msg.chat.id, `<b>My Tasks (${tasks.length})</b>`, {
//     parse_mode: "HTML",
//   });

//   for (const task of tasks) {
//     await bot.sendMessage(
//       msg.chat.id,
//       `<b>Task</b>
// Department: ${escapeHtml(task.department || "-")}
// Task: ${escapeHtml(task.task || "-")}
// Status: Pending`,
//       {
//         parse_mode: "HTML",
//         reply_markup: {
//           inline_keyboard: [
//             [
//               {
//                 text: "Status",
//                 callback_data: `status_${task.id}`,
//               },
//               {
//                 text: "Comment",
//                 callback_data: `comment_${task.id}`,
//               },
//             ],
//           ],
//         },
//       },
//     );
//   }
// }

// //new ,,,.

// const monthNames = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// function formatDate(date) {
//   if (!date) return "-";

//   const d = new Date(date);

//   return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
// }

// function generateCalendar(year, month, state = {}) {
//   const keyboard = [];

//   keyboard.push([
//     {
//       text: "<",
//       callback_data: `cal_prev_${year}_${month}`,
//     },
//     {
//       text: `${monthNames[month]} ${year}`,
//       callback_data: "ignore",
//     },
//     {
//       text: ">",
//       callback_data: `cal_next_${year}_${month}`,
//     },
//   ]);

//   keyboard.push([
//     { text: "Mo", callback_data: "ignore" },
//     { text: "Tu", callback_data: "ignore" },
//     { text: "We", callback_data: "ignore" },
//     { text: "Th", callback_data: "ignore" },
//     { text: "Fr", callback_data: "ignore" },
//     { text: "Sa", callback_data: "ignore" },
//     { text: "Su", callback_data: "ignore" },
//   ]);

//   const firstDay = new Date(year, month, 1).getDay();

//   const daysInMonth = new Date(year, month + 1, 0).getDate();

//   let row = [];

//   let startDay = firstDay === 0 ? 6 : firstDay - 1;

//   for (let i = 0; i < startDay; i++) {
//     row.push({
//       text: " ",
//       callback_data: "ignore",
//     });
//   }

//   for (let day = 1; day <= daysInMonth; day++) {
//     const currentDate = `${year}-${month}-${day}`;

//     let label = `${day}`;

//     if (state.fromDate === currentDate) {
//       label = `🟢 ${day}`;
//     }

//     if (state.toDate === currentDate) {
//       label = `🔵 ${day}`;
//     }

//     row.push({
//       text: label,
//       callback_data: `date_${year}_${month}_${day}`,
//     });

//     if (row.length === 7) {
//       keyboard.push(row);
//       row = [];
//     }
//   }

//   while (row.length < 7 && row.length !== 0) {
//     row.push({
//       text: " ",
//       callback_data: "ignore",
//     });
//   }

//   if (row.length) {
//     keyboard.push(row);
//   }

//   keyboard.push([
//     {
//       text: "Pick From",
//       callback_data: "pick_from",
//     },
//     {
//       text: "Pick To",
//       callback_data: "pick_to",
//     },
//   ]);

//   keyboard.push([
//     {
//       text: "Clear",
//       callback_data: "clear_dates",
//     },
//   ]);

//   keyboard.push([
//     {
//       text: "Cancel",
//       callback_data: "cancel_calendar",
//     },
//   ]);

//   return {
//     parse_mode: "HTML",
//     reply_markup: {
//       inline_keyboard: keyboard,
//     },
//   };
// }

// function getCalendarText(state = {}) {
//   return `
// <b>Select Date Range</b>

// Step: ${state.selectionMode === "to" ? "To Date" : "From Date"}

// From: ${formatDate(state.fromDate)}
// To: ${formatDate(state.toDate)}

// Tap dates from calendar.
// `;
// }

// function registerHandlers(bot, GROUP_IDS) {
//   bot.onText(new RegExp(`^/start${commandSuffix}`), (msg) => {
//     const commands = [
//       "/addtask",
//       ...(authorizedCreatorIds.includes(msg.from.id) ? ["/tasks"] : []),
//       "/mytasks",
//       "/completedtasks",
//       "/myid",
//     ];

//     return bot.sendMessage(
//       msg.chat.id,
//       `Bot Ready\nCommands:\n${commands.join("\n")}`,
//     );
//   });

//   bot.onText(new RegExp(`^/myid${commandSuffix}`), (msg) => {
//     return bot.sendMessage(msg.chat.id, `Your Telegram ID: ${msg.from.id}`);
//   });

//   bot.onText(new RegExp(`^/addtask${commandSuffix}`), (msg) => {
//     const userId = msg.from.id;

//     if (!authorizedCreatorIds.includes(userId)) {
//       return bot.sendMessage(msg.chat.id, "Not authorized");
//     }

//     const keyboard = departments.map((department) => [
//       { text: department, callback_data: `dep_${department}` },
//     ]);

//     selectedUsers[userId] = [];
//     delete userState[userId];

//     return bot.sendMessage(msg.chat.id, "Select Department:", {
//       reply_markup: { inline_keyboard: keyboard },
//     });
//   });

//   bot.onText(new RegExp(`^/tasks${commandSuffix}`), async (msg) => {
//     const userId = msg.from.id;

//     if (!authorizedCreatorIds.includes(userId)) {
//       return bot.sendMessage(msg.chat.id, "Not authorized");
//     }

//     const tasks = await taskService.getAllTasks();

//     if (!tasks.length) {
//       return bot.sendMessage(msg.chat.id, "No tasks");
//     }

//     return bot.sendMessage(
//       msg.chat.id,
//       `<b>Tasks</b>\n\n${tasks.map(taskLine).join("\n\n")}`,
//       { parse_mode: "HTML" },
//     );
//   });

//   bot.onText(new RegExp(`^/mytasks${commandSuffix}`), async (msg) => {
//     try {
//       const tasks = await getTasksForMessageUser(msg, false);

//       if (!tasks.length) {
//         return bot.sendMessage(msg.chat.id, "No pending tasks assigned to you");
//       }

//       return sendMyPendingTasks(bot, msg, tasks);
//     } catch (error) {
//       console.error("/mytasks failed:", formatError(error));
//       return bot.sendMessage(
//         msg.chat.id,
//         "Could not load your pending tasks. Please try again.",
//       );
//     }
//   });

//   bot.onText(new RegExp(`^/completedtasks?${commandSuffix}`), async (msg) => {
//     try {
//       const tasks = await getTasksForMessageUser(msg, true);

//       if (!tasks.length) {
//         return bot.sendMessage(msg.chat.id, "No completed tasks for you");
//       }

//       return bot.sendMessage(
//         msg.chat.id,
//         `<b>Completed Tasks (${tasks.length})</b>\n\n${tasks
//           .map(taskLine)
//           .join("\n\n")}`,
//         { parse_mode: "HTML" },
//       );
//     } catch (error) {
//       console.error("/completedtasks failed:", formatError(error));
//       return bot.sendMessage(
//         msg.chat.id,
//         "Could not load your completed tasks. Please try again.",
//       );
//     }
//   });

//   //

//   bot.on("callback_query", async (q) => {
//     const chatId = q.message.chat.id;
//     const userId = q.from.id;
//     const data = q.data || "";

//     // ================= CALENDAR =================

//     // PREVIOUS MONTH
//     if (data.startsWith("cal_prev_")) {
//       const [, , year, month] = data.split("_");

//       let y = Number(year);
//       let m = Number(month) - 1;

//       if (m < 0) {
//         m = 11;
//         y--;
//       }

//       userState[userId].calendarYear = y;
//       userState[userId].calendarMonth = m;

//       return bot.editMessageText(getCalendarText(userState[userId]), {
//         chat_id: chatId,
//         message_id: q.message.message_id,
//         ...generateCalendar(y, m, userState[userId]),
//       });
//     }

//     // NEXT MONTH
//     if (data.startsWith("cal_next_")) {
//       const [, , year, month] = data.split("_");

//       let y = Number(year);
//       let m = Number(month) + 1;

//       if (m > 11) {
//         m = 0;
//         y++;
//       }

//       userState[userId].calendarYear = y;
//       userState[userId].calendarMonth = m;

//       return bot.editMessageText(getCalendarText(userState[userId]), {
//         chat_id: chatId,
//         message_id: q.message.message_id,
//         ...generateCalendar(y, m, userState[userId]),
//       });
//     }

//     // PICK FROM
//     if (data === "pick_from") {
//       userState[userId].selectionMode = "from";

//       return bot.answerCallbackQuery(q.id, {
//         text: "Select FROM date",
//       });
//     }

//     // PICK TO
//     if (data === "pick_to") {
//       userState[userId].selectionMode = "to";

//       return bot.answerCallbackQuery(q.id, {
//         text: "Select TO date",
//       });
//     }

//     // SELECT DATE
//     if (data.startsWith("date_")) {
//       const [, year, month, day] = data.split("_");

//       const selectedDate = `${year}-${month}-${day}`;

//       if (userState[userId].selectionMode === "from") {
//         userState[userId].fromDate = selectedDate;
//       } else {
//         userState[userId].toDate = selectedDate;
//       }

//       const y = userState[userId].calendarYear;
//       const m = userState[userId].calendarMonth;

//       // BOTH DATES SELECTED
//       if (userState[userId].fromDate && userState[userId].toDate) {
//         const from = new Date(userState[userId].fromDate);

//         const to = new Date(userState[userId].toDate);

//         const diffTime = to.getTime() - from.getTime();

//         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//         if (diffDays < 1) {
//           return bot.answerCallbackQuery(q.id, {
//             text: "To date must be after From date",
//             show_alert: true,
//           });
//         }

//         userState[userId].customDays = diffDays;

//         return createTasksForSelection(
//           bot,
//           chatId,
//           userId,
//           userState[userId].groupId,
//           userState[userId],
//         );
//       }

//       return bot.editMessageText(getCalendarText(userState[userId]), {
//         chat_id: chatId,
//         message_id: q.message.message_id,
//         ...generateCalendar(y, m, userState[userId]),
//       });
//     }

//     // CLEAR DATES
//     if (data === "clear_dates") {
//       userState[userId].fromDate = null;
//       userState[userId].toDate = null;

//       return bot.editMessageText(getCalendarText(userState[userId]), {
//         chat_id: chatId,
//         message_id: q.message.message_id,
//         ...generateCalendar(
//           userState[userId].calendarYear,
//           userState[userId].calendarMonth,
//           userState[userId],
//         ),
//       });
//     }

//     // CANCEL
//     if (data === "cancel_calendar") {
//       delete userState[userId];

//       return bot.deleteMessage(chatId, q.message.message_id);
//     }

//     // ================Update status========================
//     // if (data.startsWith("setstatus_")) {
//     //   const parts = data.split("_");

//     //   const taskId = parts[1];
//     //   const status = parts[2];
//     //   const task = await taskService.getTaskById(taskId);

//     //   if (!task) {
//     //     return bot.answerCallbackQuery(q.id, {
//     //       text: "Task not found",
//     //       show_alert: true,
//     //     });
//     //   }

//     //   await taskService.updateTaskStatus(taskId, status);

//     //   // await taskService.addStatusHistory(
//     //   //   taskId,
//     //   //   status,
//     //   //   q.from.username || q.from.first_name,
//     //   // );

//     //   return bot.answerCallbackQuery(q.id, {
//     //     text: `Status updated to ${status}`,
//     //   });
//     // }

//     if (data.startsWith("setstatus_")) {
//       const parts = data.split("_");

//       const taskId = parts[1];
//       const status = parts[2];

//       const task = await taskService.getTaskById(taskId);

//       if (!task) {
//         return bot.answerCallbackQuery(q.id, {
//           text: "Task not found",
//           show_alert: true,
//         });
//       }

//       await taskService.updateTaskStatus(taskId, status);

//       await taskService.addStatusHistory(
//         taskId,
//         status,
//         q.from.username || q.from.first_name,
//       );

//       // COMPLETION EMAIL
//       if (status === "Completed") {
//         try {
//           const updatedTask = await taskService.getTaskById(taskId);

//           await sendCompletionEmail(
//             updatedTask,
//             q.from.username || q.from.first_name,
//           );

//           console.log("Completion email sent from status update");
//         } catch (error) {
//           console.log("Completion email failed:", error.message);
//         }
//       }

//       return bot.answerCallbackQuery(q.id, {
//         text: `Status updated to ${status}`,
//       });
//     }
//     // ================= Comment Button TASK =================
//     if (data.startsWith("comment_")) {
//       const taskId = data.replace("comment_", "");

//       userState[userId] = {
//         stage: "comment",
//         taskId,
//       };

//       return bot.sendMessage(chatId, "Enter your comment:");
//     }

//     // ================= Status Button TASK =================
//     if (data.startsWith("status_")) {
//       const taskId = data.replace("status_", "");

//       return bot.sendMessage(chatId, "Select Status", {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               {
//                 text: "Started",
//                 callback_data: `setstatus_${taskId}_Started`,
//               },
//             ],
//             [
//               {
//                 text: "Pending",
//                 callback_data: `setstatus_${taskId}_Pending`,
//               },
//             ],
//             [
//               {
//                 text: "Completed",
//                 callback_data: `setstatus_${taskId}_Completed`,
//               },
//             ],
//           ],
//         },
//       });
//     }

//     // ================= COMPLETE TASK =================

//     if (data.startsWith("complete_")) {
//       const [, taskId, telegramId] = data.split("_");

//       const task = await taskService.getTaskById(taskId);

//       const clickedUsername = cleanUsername(
//         q.from.username || q.from.first_name,
//       );

//       const assignedUsername = cleanUsername(task?.person);

//       const idMatches =
//         String(q.from.id).trim() === String(telegramId || "").trim();

//       const usernameMatches =
//         assignedUsername && clickedUsername === assignedUsername;

//       if (!task) {
//         return bot.answerCallbackQuery(q.id, {
//           text: "Task not found",
//           show_alert: true,
//         });
//       }

//       // NEW CHECK
//       if (task.completed) {
//         return bot.answerCallbackQuery(q.id, {
//           text: "Task already completed",
//           show_alert: true,
//         });
//       }

//       if (!idMatches && !usernameMatches) {
//         return bot.answerCallbackQuery(q.id, {
//           text: "Only assigned user can complete",
//           show_alert: true,
//         });
//       }

//       await taskService.completeTask(taskId);

//       try {
//         const updatedTask = await taskService.getTaskById(taskId);

//         await sendCompletionEmail(
//           updatedTask,
//           q.from.username || q.from.first_name,
//         );

//         console.log("✅ Completion email sent");
//       } catch (error) {
//         console.log("❌ Completion email failed:", error.message);
//       }

//       await bot.answerCallbackQuery(q.id, {
//         text: "Task completed",
//       });

//       return bot.sendMessage(chatId, "Task completed");
//     }

//     // ================= AUTH CHECK =================

//     if (!authorizedCreatorIds.includes(userId)) {
//       return bot.answerCallbackQuery(q.id, {
//         text: "Not allowed",
//         show_alert: true,
//       });
//     }

//     // ================= DEPARTMENT SELECT =================

//     if (data.startsWith("dep_")) {
//       const department = data.replace("dep_", "").trim().toLowerCase();

//       const users = await userService.getUsersByDepartment(department);

//       if (!users || users.length === 0) {
//         return bot.sendMessage(chatId, "No users found");
//       }

//       selectedUsers[userId] = [];

//       const keyboard = users.map((user) => [
//         {
//           text: getUserTaskName(user),
//           callback_data: `user_${user.id}`,
//         },
//       ]);

//       keyboard.push([
//         {
//           text: "Done",
//           callback_data: "done_users",
//         },
//       ]);

//       return bot.sendMessage(chatId, "Select Users:", {
//         reply_markup: {
//           inline_keyboard: keyboard,
//         },
//       });
//     }

//     // ================= SELECT USER =================

//     if (data.startsWith("user_")) {
//       const selectedUserId = data.replace("user_", "");

//       if (!selectedUsers[userId]) {
//         selectedUsers[userId] = [];
//       }

//       if (!selectedUsers[userId].includes(selectedUserId)) {
//         selectedUsers[userId].push(selectedUserId);
//       }

//       return bot.answerCallbackQuery(q.id, {
//         text: "Added",
//       });
//     }

//     // ================= DONE USERS =================

//     if (data === "done_users") {
//       if (!selectedUsers[userId]?.length) {
//         return bot.sendMessage(chatId, "Select at least one user");
//       }

//       // userState[userId] = {
//       //   selectedUserIds: selectedUsers[userId],
//       // };
//       userState[userId] = {
//         selectedUserIds: selectedUsers[userId],
//         groupId: chatId,
//       };

//       return bot.sendMessage(chatId, "Enter Task:");
//     }

//     // ================= REMINDER =================

//     if (data.startsWith("reminder_")) {
//       const frequency = data.replace("reminder_", "");

//       const validFrequency = reminderOptions.some(
//         ([, value]) => value === frequency,
//       );

//       if (!validFrequency || !userState[userId]?.taskText) {
//         return bot.answerCallbackQuery(q.id, {
//           text: "Task setup expired. Start again.",
//           show_alert: true,
//         });
//       }

//       userState[userId].reminderFrequency = frequency;

//       // CUSTOM CALENDAR
//       if (frequency === "custom") {
//         const now = new Date();

//         userState[userId].stage = "calendar";

//         userState[userId].selectionMode = "from";

//         userState[userId].calendarYear = now.getFullYear();

//         userState[userId].calendarMonth = now.getMonth();

//         userState[userId].fromDate = null;
//         userState[userId].toDate = null;

//         await bot.answerCallbackQuery(q.id);

//         return bot.sendMessage(
//           chatId,
//           getCalendarText(userState[userId]),
//           generateCalendar(
//             now.getFullYear(),
//             now.getMonth(),
//             userState[userId],
//           ),
//         );
//       }

//       await bot.answerCallbackQuery(q.id, {
//         text: `${frequency} selected`,
//       });

//       return createTasksForSelection(
//         bot,
//         chatId,
//         userId,
//         // GROUP_ID,
//         userState[userId].groupId,
//         userState[userId],
//       );
//     }
//   });

//   //

//   // ✅ CREATE TASK
//   bot.on("message", async (msg) => {
//     const chatId = msg.chat.id;
//     const userId = msg.from.id;
//     const text = msg.text || "";

//     // if (!authorizedCreatorIds.includes(userId)) return;
//     if (
//       !authorizedCreatorIds.includes(userId) &&
//       userState[userId]?.stage !== "comment"
//     ) {
//       return;
//     }

//     if (!userState[userId] || text.startsWith("/")) return;

//     const state = userState[userId];

//     // if (state.stage === "custom_reminder") {
//     //   const customDays = Number(text.trim());

//     //   if (!Number.isInteger(customDays) || customDays < 1) {
//     //     return bot.sendMessage(
//     //       chatId,
//     //       "Enter a whole number of days (1 or more):",
//     //     );
//     //   }

//     //   state.customDays = customDays;
//     //   return createTasksForSelection(bot, chatId, userId, GROUP_ID, state);
//     // }

//     if (state.stage === "comment") {
//       await taskService.addTaskComment(
//         state.taskId,
//         text,
//         msg.from.username || msg.from.first_name,
//       );

//       await bot.sendMessage(chatId, "Comment added");

//       delete userState[userId];

//       return;
//     }

//     if (state.stage !== "reminder") {
//       state.taskText = text.trim();
//       state.stage = "reminder";

//       const keyboard = reminderOptions.map(([label, value]) => [
//         { text: label, callback_data: `reminder_${value}` },
//       ]);

//       return bot.sendMessage(chatId, "Select Reminder Frequency:", {
//         reply_markup: { inline_keyboard: keyboard },
//       });
//     }

//     return bot.sendMessage(chatId, "Select a reminder option above.");
//     /*

//       // ✅ SEND EMAIL
//       if (user.email) {
//         try {
//           await sendAssignmentEmail(user.email, task);

//           console.log("✅ Email sent to:", user.email);
//         } catch (error) {
//           console.log("❌ Email error:", error.message);
//         }
//       }
//     }

//     await bot.sendMessage(chatId, "Task created for selected users!");

//     delete userState[userId];
//     delete selectedUsers[userId];
//     */
//   });
// }

// module.exports = registerHandlers;
