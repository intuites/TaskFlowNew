// supabaseAdmin.js
// supabaseAdmin.js
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: {
      transport: WebSocket,
    },
  }
);

async function runSQL(sql) {
  const { data, error } = await supabaseAdmin.rpc("exec_sql", { sql });

  if (error) throw error;
  return data;
}

module.exports = { supabaseAdmin, runSQL };


// require("dotenv").config();
// const { createClient } = require("@supabase/supabase-js");

// const supabaseAdmin = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_KEY,
// );

// async function runSQL(sql) {
//   const { data, error } = await supabaseAdmin.rpc("exec_sql", { sql });

//   if (error) throw error;
//   return data;
// }

// module.exports = { supabaseAdmin, runSQL };
