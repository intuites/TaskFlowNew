const supabase = require("../../../config/supabaseClient");

// GET ALL
exports.getDepartments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// CREATE
exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    const { data, error } = await supabase
      .from("departments")
      .insert([{ name }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      department: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// UPDATE
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const { error } = await supabase
      .from("departments")
      .update({ name })
      .eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      message: "Department updated",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// DELETE
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("departments").delete().eq("id", id);

    if (error) throw error;

    res.json({
      success: true,
      message: "Department deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
