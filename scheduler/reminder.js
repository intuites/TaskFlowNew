// reminder.js
const cron = require("node-cron");
const taskService = require("../services/taskService");
const userService = require("../services/userService");
const { sendReminderEmail } = require("../services/emailService");
const { authorizedCreatorIds } = require("../bot/auth");

function getNextReminderDate(task, fromDate) {
  const next = new Date(fromDate);

  switch (task.reminder_frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    case "custom":
      next.setUTCDate(
        next.getUTCDate() + Number(task.reminder_interval_days || 1),
      );
      break;
    default:
      return null;
  }

  return next;
}

cron.schedule("* * * * *", async () => {
  const now = new Date();

  try {
    const tasks = await taskService.getDueReminderTasks(
      authorizedCreatorIds,
      now,
    );

    for (const task of tasks) {
      const user = await userService.getUserByUsername(task.person);
      let nextReminder = getNextReminderDate(
        task,
        new Date(task.next_reminder_at),
      );

      while (nextReminder && nextReminder <= now) {
        nextReminder = getNextReminderDate(task, nextReminder);
      }

      if (!user?.email) {
        console.log(`Reminder skipped; no email found for ${task.person}`);
        await taskService.updateTaskReminder(
          task.id,
          nextReminder?.toISOString() || null,
          now.toISOString(),
        );
        continue;
      }

      try {
        // await sendReminderEmail(user.email, task);
        const history = await taskService.getTaskStatusHistory(task.id);

        const comments = await taskService.getTaskComments(task.id);

        await sendReminderEmail(user.email, task, history, comments);

        await taskService.updateTaskReminder(
          task.id,
          nextReminder?.toISOString() || null,
          now.toISOString(),
        );

        console.log(`Reminder sent to ${user.email}`);
      } catch (error) {
        console.log(`Reminder failed for task ${task.id}:`, error.message);
      }
    }
  } catch (error) {
    console.log("Reminder scheduler error:", error.message);
  }
});

console.log("Recurring reminder scheduler started");
