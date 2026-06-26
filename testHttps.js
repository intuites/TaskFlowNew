const https = require("https");

https
  .get("https://www.google.com", (res) => {
    console.log("Status:", res.statusCode);
  })
  .on("error", (err) => {
    console.error(err);
  });
