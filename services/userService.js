// userService.js
const supabase = require("../config/supabaseClient");

// =========================
//  GET USERS BY DEPARTMENT (ROBUST + DEBUG)
// =========================
async function getUsersByDepartment(department) {
  const clean = (department || "").trim().toLowerCase();

  console.log(" [Service] Incoming department:", department);
  console.log(" [Service] Clean department:", clean);

  //  fetch all users first (avoid Supabase filter issues)
  const { data, error } = await supabase.from("users").select("*");

  if (error) {
    console.error("❌ [Service] DB ERROR:", error);
    throw error;
  }

  console.log("[Service] ALL USERS FROM DB:", data);

  //  manual filtering (100% reliable)
  const filtered = (data || []).filter((u) => {
    const userDept = (u.department || "").trim().toLowerCase();
    return userDept === clean;
  });

  console.log("[Service] FILTERED USERS:", filtered);

  return filtered;
}

// =========================
//  GET USER BY ID
// =========================
async function getUserById(id) {
  console.log("[Service] Fetch user by ID:", id);

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle(); // safer than single()

  if (error) {
    console.error("❌ [Service] getUserById ERROR:", error);
    throw error;
  }

  console.log("[Service] USER FOUND:", data);

  return data;
}

// =========================
//  GET USER BY TELEGRAM ID (optional)
// =========================
async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId.toString())
    .maybeSingle();

  if (error) {
    console.error("getUserByTelegramId ERROR:", error);
    return null;
  }

  return data;
}

// =========================
//  CREATE USER
// =========================
async function createUser(user) {
  console.log("[Service] Creating user:", user);

  const { data, error } = await supabase.from("users").insert([user]);

  if (error) {
    console.error("❌ [Service] createUser ERROR:", error);
    throw error;
  }

  return data;
}

async function getUserByUsername(username) {
  const cleanUsername = String(username || "")
    .replace("@", "")
    .trim();

  if (!cleanUsername) {
    return null;
  }

  const { data, error } = await supabase.from("users").select("*");

  if (error) return null;

  return (
    (data || []).find((user) => {
      const names = [user.username, user.telegram_username, user.name].map(
        (value) =>
          String(value || "")
            .replace("@", "")
            .trim()
            .toLowerCase(),
      );

      return names.includes(cleanUsername.toLowerCase());
    }) || null
  );
}

// =========================
// DELETE USER
// =========================
async function deleteUser(userId) {
  const { error } = await supabase.from("users").delete().eq("id", userId);

  if (error) {
    console.error("❌ deleteUser ERROR:", error);
    throw error;
  }

  return true;
}

// =========================
//  EXPORTS
// =========================
module.exports = {
  getUsersByDepartment,
  getUserById,
  getUserByTelegramId,
  createUser,
  getUserByUsername,
  deleteUser,
};
