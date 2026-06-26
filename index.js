// index.js
require("dotenv").config();

const { setupDatabase } = require("./services/dbSetupService");

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", JSON.stringify(reason, null, 2));
});

// Start DB setup
(async () => {
  try {
    await setupDatabase();
    console.log("✅ DB Setup Done");

    require("./bot/bot");
    require("./scheduler/reminder");

    console.log("🤖 Bot Running...");
  } catch (err) {
    console.error("❌ Startup Error:", err);
  }
})();
