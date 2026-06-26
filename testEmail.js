require('dotenv').config();
const { sendAssignmentEmail } = require('./services/emailService');
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);

(async () => {
    try {
        console.log("Testing email...");
        await sendAssignmentEmail("akhilesh@intuites.com", { department: "Test", task: "Testing email" });
        console.log("Email sent successfully!");
    } catch (e) {
        console.error("Email failed:", e);
    }
})();