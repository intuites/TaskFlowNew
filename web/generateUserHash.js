// generateUserHash.js
const bcrypt = require("bcryptjs");

bcrypt.hash("User@123", 10).then((hash) => {
  console.log(hash);
});
