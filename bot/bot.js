// bot.js
//updated bot with commands below

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const registerHandlers = require("./handlers");
const { authorizedCreatorIds } = require("./auth");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ✅ REGISTER COMMANDS (THIS FIXES YOUR ISSUE)
const publicCommands = [
  // { command: "start", description: "Start the bot" },
  { command: "addtask", description: "Create a new task" },
  { command: "mytasks", description: "View all pending tasks" },
  { command: "completedtasks", description: "View my completed tasks" },
];

const creatorCommands = [
  ...publicCommands,
  { command: "tasks", description: "View all tasks" },
  { command: "adduser", description: "Add department user" },
  { command: "deleteuser", description: "Delete department user" },
  { command: "listusers", description: "View department users" },
  { command: "adddepartment", description: "Add department" },

  { command: "departments", description: "View departments" },

  { command: "updatedepartment", description: "Update department" },

  { command: "deletedepartment", description: "Delete department" },
];

const groupChatIds = (process.env.GROUP_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

async function registerBotCommands() {
  // Default menu for regular users
  await bot.setMyCommands(publicCommands);

  for (const creatorId of authorizedCreatorIds) {
    // Creator private chat commands
    await bot.setMyCommands(creatorCommands, {
      scope: { type: "chat", chat_id: creatorId },
    });

    // Creator commands in ALL configured groups
    for (const groupChatId of groupChatIds) {
      await bot.setMyCommands(creatorCommands, {
        scope: {
          type: "chat_member",
          chat_id: groupChatId,
          user_id: creatorId,
        },
      });
    }
  }
}

registerBotCommands().catch((error) => {
  console.error("Failed to register bot commands:", error.message);
});

// (Optional) Set commands only for groups
// bot.setMyCommands(publicCommands, {
//   scope: { type: "all_group_chats" }
// });

// (Optional) Set commands only for private chat
// bot.setMyCommands(publicCommands, {
//   scope: { type: "all_private_chats" }
// });

registerHandlers(bot, groupChatIds);

module.exports = bot;
// // ......................................................................................................
// //Working1...............................................................................................
// // require("dotenv").config();
// // const TelegramBot = require("node-telegram-bot-api");
// // const registerHandlers = require("./handlers");

// // const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// // registerHandlers(bot, process.env.GROUP_CHAT_ID);

// // module.exports = bot;

// //updated bot with commands below

// require("dotenv").config();
// const TelegramBot = require("node-telegram-bot-api");
// const registerHandlers = require("./handlers");
// const { authorizedCreatorIds } = require("./auth");
// const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// // ✅ REGISTER COMMANDS (THIS FIXES YOUR ISSUE)
// const publicCommands = [
//   // { command: "start", description: "Start the bot" },
//   { command: "addtask", description: "Create a new task" },
//   { command: "mytasks", description: "View all pending tasks" },
//   { command: "completedtasks", description: "View my completed tasks" },
// ];

// const creatorCommands = [
//   ...publicCommands,
//   { command: "tasks", description: "View all tasks" },
// ];

// async function registerBotCommands() {
//   const groupChatId = process.env.GROUP_CHAT_ID;

//   // Default menu for regular users.
//   await bot.setMyCommands(publicCommands);

//   for (const creatorId of authorizedCreatorIds) {
//     // Creator's private bot chat menu.
//     await bot.setMyCommands(creatorCommands, {
//       scope: { type: "chat", chat_id: creatorId },
//     });

//     // Creator's command menu inside the configured group.
//     if (groupChatId) {
//       await bot.setMyCommands(creatorCommands, {
//         scope: {
//           type: "chat_member",
//           chat_id: groupChatId,
//           user_id: creatorId,
//         },
//       });
//     }
//   }
// }

// registerBotCommands().catch((error) => {
//   console.error("Failed to register bot commands:", error.message);
// });

// // (Optional) Set commands only for groups
// // bot.setMyCommands(publicCommands, {
// //   scope: { type: "all_group_chats" }
// // });

// // (Optional) Set commands only for private chat
// // bot.setMyCommands(publicCommands, {
// //   scope: { type: "all_private_chats" }
// // });

// registerHandlers(bot, process.env.GROUP_CHAT_ID);

// module.exports = bot;
