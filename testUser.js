const bcrypt = require("bcryptjs");

(async () => {
  const hash = await bcrypt.hash("Welcome@123", 10);

  console.log(hash);
})();

// require('dotenv').config();
// const supabase = require('./config/supabaseClient');

// (async () => {
//     const { data, error } = await supabase.from('users').select('*');
//     if (error) {
//         console.error("Error fetching users:", error);
//     } else {
//         console.log("Users in DB:", data);
//     }
// })();
