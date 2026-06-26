// require("dotenv").config();
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const departmentRoutes = require("./routes/departmentRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/departments", departmentRoutes);

const PORT = process.env.WEB_PORT || 5000;

app.listen(PORT, () => {
  console.log(`🌐 Web Portal Running On Port ${PORT}`);
});
