// emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📧 TASK ASSIGNED
async function sendAssignmentEmail(to, task) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    cc: process.env.CC_EMAIL,
    subject: `Task "${task.task}" Assigned`,
    html: `
      <h3>Task Assigned</h3>

      <p><b>Department:</b> ${task.department}</p>

      <p><b>Task:</b> ${task.task}</p>
    `,
  });
}
// function buildHistoryHtml(history = []) {
//   return history
//     .map(
//       (h) => `
//       <li>
//       ${h.created_at}
//       - ${h.status}
//       - ${h.updated_by}
//       </li>
//    `,
//     )
//     .join("");
// }

// buildactivityhistory
function buildActivityTable(history = [], comments = []) {
  const activities = [];

  history.forEach((h) => {
    activities.push({
      date: h.created_at,
      type: "Status",
      user: h.updated_by,
      details: h.status,
    });
  });

  comments.forEach((c) => {
    activities.push({
      date: c.created_at,
      type: "Comment",
      user: c.commented_by,
      details: c.comment,
    });
  });

  activities.sort((a, b) => new Date(a.date) - new Date(b.date));

  return `
  <table border="1"
         cellpadding="8"
         cellspacing="0"
         width="100%"
         style="border-collapse:collapse;">

    <tr style="background:#f2f2f2;">
      <th>Date</th>
      <th>Type</th>
      <th>Details</th>
      <th>User</th>
    </tr>

    ${activities
      .map(
        (a) => `
      <tr>
        <td>${new Date(a.date).toLocaleString()}</td>
        <td>${a.type}</td>
        <td>${a.details}</td>
        <td>${a.user}</td>
      </tr>
    `,
      )
      .join("")}

  </table>
  `;
}

function buildHistoryHtml(history = []) {
  if (!history.length) {
    return "<p>No status history available</p>";
  }

  return `
  <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr style="background:#f2f2f2;">
      <th>Date</th>
      <th>Status</th>
      <th>Updated By</th>
    </tr>

    ${history
      .map(
        (h) => `
      <tr>
        <td>${new Date(h.created_at).toLocaleString("en-US", {
          timeZone: "America/New_York",
        })}</td>
        <td>${h.status}</td>
        <td>${h.updated_by}</td>
      </tr>
    `,
      )
      .join("")}
  </table>
  `;
}

function buildCommentsHtml(comments = []) {
  if (!comments.length) {
    return "<p>No comments available</p>";
  }

  return `
  <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr style="background:#f2f2f2;">
      <th>Date</th>
      <th>Commented By</th>
      <th>Comment</th>
    </tr>

    ${comments
      .map(
        (c) => `
      <tr>
        <td>${new Date(c.created_at).toLocaleString("en-US", {
          timeZone: "America/New_York",
        })}</td>
        <td>${c.commented_by}</td>
        <td>${c.comment}</td>
      </tr>
    `,
      )
      .join("")}
  </table>
  `;
}

//coments buld
// function buildCommentsHtml(comments = []) {
//   return comments
//     .map(
//       (c) => `
//       <li>
//       ${c.created_at}
//       - ${c.commented_by}
//       - ${c.comment}
//       </li>
//    `,
//     )
//     .join("");
// }

// 📧 TASK REMINDER
// async function sendReminderEmail(to, task, history, comments) {
//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to,
//     cc: process.env.CC_EMAIL,
//     subject: `Task "${task.task}" Reminder`,
//     // html: `
//     //   <div style="font-family: Arial, sans-serif;">
//     //     <h3>Pending Task Reminder</h3>

//     //     <p>This is a reminder for your pending task.</p>

//     //     <p><b>Department:</b> ${task.department}</p>

//     //     <p><b>Task:</b> ${task.task}</p>

//     //     <br/>

//     //     <p><b>Please complete it as soon as possible.</b></p>
//     //   </div>
//     // `,

//     html: `
//    <div style="font-family: Arial, sans-serif;">

//    <h3>Pending Task Reminder</h3>

//    <p><b>Department:</b> ${task.department}</p>

//    <p><b>Task:</b> ${task.task}</p>

//     <p><b>Current Status:</b> ${task.status || "Pending"}</p>

//     <h4>Status History</h4>

//     ${buildHistoryHtml(history)}

//    <br/>

//    <h4>Comments</h4>

//    ${buildCommentsHtml(comments)}

//    </div>
//    `,
//   });
// }

function buildStatusHistoryWithComments(history = [], comments = []) {
  if (!history.length) {
    return "<p>No status history available</p>";
  }

  return `
  <table border="1"
         cellpadding="8"
         cellspacing="0"
         width="100%"
         style="border-collapse:collapse;">

    <tr style="background:#f2f2f2;">
      <th>Date</th>
      <th>Status</th>
      <th>Comment</th>
    </tr>

    ${history
      .map((h) => {
        const comment = comments.find((c) => c.created_at >= h.created_at);

        return `
        <tr>
          <td>
            ${new Date(h.created_at).toLocaleString()}
          </td>

          <td>${h.status}</td>

          <td>
            ${comment?.comment || "-"}
          </td>
        </tr>
      `;
      })
      .join("")}

  </table>
  `;
}

async function sendReminderEmail(to, task, history = [], comments = []) {
  const createdDate = new Date(task.created_at);

  const daysPending = Math.floor(
    (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formattedDate = createdDate.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const emailSubject =
    `${task.task} -> ${formattedDate} -> ` +
    `${task.status || "Pending"} since ${daysPending} day${
      daysPending !== 1 ? "s" : ""
    }`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    cc: process.env.CC_EMAIL,

    subject: emailSubject,

    html: `
    <div style="font-family: Arial, sans-serif;">

      <h2>Task Reminder</h2>

      <p><b>Department:</b> ${task.department}</p>

      <p><b>Task:</b> ${task.task}</p>

      <p><b>Current Status:</b> ${task.status || "Pending"}</p>

      <p><b>Created On:</b> ${formattedDate}</p>

      <p><b>Pending Since:</b> ${daysPending} Days</p>

      <hr/>

      <h3>Status History</h3>

${buildStatusHistoryWithComments(history, comments)}

     

    </div>
    `,
  });
}

// 📧 TASK COMPLETED
// async function sendCompletionEmail(task, user, history = [], comments = []) {
//   try {
//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: process.env.ADMIN_EMAIL,
//       cc: process.env.CC_EMAIL,
//       subject: `Task "${task.task}" Completed`,

//       html: `
//         <div style="font-family: Arial, sans-serif;">
//           <h2>Task Completed</h2>

//           <p><b>User:</b> ${user}</p>

//           <p><b>Department:</b> ${task.department}</p>

//           <p><b>Task:</b> ${task.task}</p>

//           <br/>

//           <p>The task has been marked as completed.</p>
//         </div>
//       `,
//     });

//     console.log("✅ Completion email sent");
//   } catch (error) {
//     console.log("❌ Completion email failed:", error.message);
//   }
// }

async function sendCompletionEmail(task, user, history = [], comments = []) {
  try {
    const createdDate = new Date(task.created_at);

    const completedDate = new Date();

    const totalDays = Math.floor(
      (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,

      to: process.env.ADMIN_EMAIL,

      cc: process.env.CC_EMAIL,

      subject: `${task.task} -> Completed`,

      html: `
      <div style="font-family: Arial, sans-serif;">

        <h2>✅ Task Completed</h2>

        <p><b>Completed By:</b> ${user}</p>

        <p><b>Department:</b> ${task.department}</p>

        <p><b>Task:</b> ${task.task}</p>

        <p><b>Status:</b> Completed</p>

        <p><b>Created:</b>
          ${createdDate.toLocaleString()}
        </p>

        <p><b>Completed:</b>
          ${completedDate.toLocaleString()}
        </p>

        <p><b>Total Duration:</b>
          ${totalDays} day(s)
        </p>

        <hr/>

        <h3>Task Activity History</h3>

        ${buildActivityTable(history, comments)}

      </div>
      `,
    });

    console.log("✅ Completion email sent");
  } catch (error) {
    console.log("❌ Completion email failed:", error.message);
  }
}

module.exports = {
  sendAssignmentEmail,
  sendReminderEmail,
  sendCompletionEmail,
};

// -----------------------------------------------------------------------------------------------------
// Working perfectly .....................................................................................
// emailService.js
