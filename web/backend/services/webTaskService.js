// webTaskService.js
// webTaskService.js
const taskService = require("../../../services/taskService");
const userService = require("../../../services/userService");

const {
  sendAssignmentEmail,
  sendCompletionEmail,
} = require("../../../services/emailService");

module.exports = {
  taskService,
  userService,
  sendAssignmentEmail,
  sendCompletionEmail,
};
// const supabase = require("../../../config/supabaseClient");

// async function getDepartments() {
//   const { data, error } = await supabase.from("users").select("department");

//   if (error) throw error;

//   return [...new Set(data.map((d) => d.department).filter(Boolean))];
// }

// async function getUsersByDepartment(department) {
//   const { data, error } = await supabase
//     .from("users")
//     .select("*")
//     .eq("department", department);

//   if (error) throw error;

//   return data;
// }

// module.exports = {
//   getDepartments,
//   getUsersByDepartment,
// };
