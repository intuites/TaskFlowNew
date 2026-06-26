// supabaseClient.js
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

console.log("SUPABASE URL:", process.env.SUPABASE_URL);
console.log("SERVICE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

module.exports = supabase;
