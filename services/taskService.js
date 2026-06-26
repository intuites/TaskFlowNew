// taskService.js
const supabase = require("../config/supabaseClient");

// =========================
// ➕ CREATE TASK
// =========================
async function createTask(data) {
  const { data: result, error } = await supabase
    .from("tasks")
    .insert([data])
    .select()
    .single();

  if (error) {
    const errorText = JSON.stringify(error);

    if (
      Object.prototype.hasOwnProperty.call(data, "assigned_telegram_id") &&
      errorText.includes("assigned_telegram_id")
    ) {
      const fallbackData = { ...data };
      delete fallbackData.assigned_telegram_id;

      const { data: fallbackResult, error: fallbackError } = await supabase
        .from("tasks")
        .insert([fallbackData])
        .select()
        .single();

      if (fallbackError) throw fallbackError;
      return fallbackResult;
    }

    throw error;
  }

  return result;
}

// =========================
// ⏳ GET PENDING TASKS
// (used for scheduler reminders)
// =========================
async function getPendingTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("completed", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// =========================
// 📋 GET ALL TASKS
// =========================
async function getAllTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// =========================
// GET TASK BY ID
// =========================
async function getTaskById(id) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// =========================
// ⏳ GET ONLY PENDING TASKS
// (used for /pendingtasks command)
// =========================
async function getPendingTasksOnly() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("completed", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// =========================
// 👤 GET TASKS BY PERSON
// (used for /mytasks command)
// =========================
// async function getTasksByPerson(personName) {
//   const { data, error } = await supabase
//     .from("tasks")
//     .select("*")
//     // .ilike("person", personName)
//     .ilike("person", `%${personName}%`)
//     .order("created_at", { ascending: false });

//   if (error) throw error;
//   return data;
// }
async function getTasksByPerson(personName) {
  const cleanName = String(personName || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

  if (!cleanName) {
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).filter((task) => {
    const taskPerson = String(task.person || "")
      .replace("@", "")
      .trim()
      .toLowerCase();

    return taskPerson === cleanName || taskPerson.includes(cleanName);
  });
}

// =========================
// ✅ COMPLETE TASK
// =========================
async function getTasksByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_telegram_id", telegramId.toString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTasksByTelegramId ERROR:", error);
    return [];
  }

  return data;
}

async function getDueReminderTasks(creatorIds, now = new Date()) {
  const ids = creatorIds.map(String);

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("completed", false)
    .in("created_by_telegram_id", ids)
    .not("next_reminder_at", "is", null)
    .lte("next_reminder_at", now.toISOString())
    .order("next_reminder_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function updateTaskReminder(id, nextReminderAt, lastRemindedAt) {
  const { error } = await supabase
    .from("tasks")
    .update({
      next_reminder_at: nextReminderAt,
      last_reminded_at: lastRemindedAt,
    })
    .eq("id", id);

  if (error) throw error;
}

async function completeTask(id) {
  const { error } = await supabase
    .from("tasks")
    .update({ completed: true })
    .eq("id", id);

  if (error) throw error;
}
// =========================
// 📨 UPDATE Status
// =========================

// async function updateTaskStatus(taskId, status) {
//   const completed = status === "Completed";

//   const { error } = await supabase
//     .from("tasks")
//     .update({
//       status,
//       completed,
//     })
//     .eq("id", taskId);

//   if (error) throw error;
// }

async function updateTaskStatus(taskId, status) {
  const completed = status === "Completed";

  const updateData = {
    status,
    completed,
  };

  // stop future reminders
  if (completed) {
    updateData.next_reminder_at = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId);

  if (error) throw error;
}
// Status Hiestroy
async function addStatusHistory(taskId, status, user) {
  const { error } = await supabase.from("task_status_history").insert({
    task_id: taskId,
    status,
    updated_by: user,
  });

  if (error) throw error;
}
// Get Staus Histroy
async function getTaskStatusHistory(taskId) {
  const { data, error } = await supabase
    .from("task_status_history")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");

  if (error) throw error;

  return data || [];
}

// Add Comment
async function addTaskComment(taskId, comment, user) {
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    comment,
    commented_by: user,
  });

  if (error) throw error;
}
// Get Comment
async function getTaskComments(taskId) {
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");

  if (error) throw error;

  return data || [];
}

// =========================
// 📨 UPDATE MESSAGE ID
// =========================
async function updateMessageId(id, message_id) {
  const { error } = await supabase
    .from("tasks")
    .update({ message_id })
    .eq("id", id);

  if (error) throw error;
}

// =========================
// 🗑 DELETE TASK
// =========================
async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw error;
}

// =========================
// 📊 GET TASK COUNT SUMMARY
// =========================
async function getTaskSummary() {
  const { data: allTasks, error } = await supabase
    .from("tasks")
    .select("completed");

  if (error) throw error;

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  const pending = total - completed;

  return {
    total,
    completed,
    pending,
  };
}

// =========================
// 🚀 EXPORT ALL FUNCTIONS
// =========================
module.exports = {
  createTask,
  getPendingTasks,
  getDueReminderTasks,
  updateTaskReminder,
  getPendingTasksOnly,
  getAllTasks,
  getTaskById,
  getTasksByPerson,
  getTasksByTelegramId,
  completeTask,
  updateMessageId,
  deleteTask,
  getTaskSummary,
  updateTaskStatus,
  addStatusHistory,
  getTaskStatusHistory,
  addTaskComment,
  getTaskComments,
};
