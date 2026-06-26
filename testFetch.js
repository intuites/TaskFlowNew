fetch("https://www.google.com")
  .then((res) => {
    console.log("Status:", res.status);
    return res.text();
  })
  .then(() => console.log("HTTPS works"))
  .catch((err) => console.error("Fetch failed:", err));
