const supabase = require("../config/supabaseClient");

// =========================
// GET ALL
// =========================
async function getDepartments() {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) throw error;

  return data || [];
}

// =========================
// CREATE
// =========================
async function createDepartment(name) {
  const { data, error } = await supabase
    .from("departments")
    .insert([{ name }])
    .select()
    .single();

  if (error) throw error;

  return data;
}

// =========================
// UPDATE
// =========================
async function updateDepartment(id, name) {
  const { error } = await supabase
    .from("departments")
    .update({ name })
    .eq("id", id);

  if (error) throw error;
}

// =========================
// DELETE
// =========================
async function deleteDepartment(id) {
  const { error } = await supabase.from("departments").delete().eq("id", id);

  if (error) throw error;
}

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
