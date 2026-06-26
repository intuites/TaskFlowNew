// tasks.js
const API = "http://localhost:5000/api";

// =======================
// LOAD MY TASKS
// =======================

const myTaskTable = document.getElementById("myTaskTable");

if (myTaskTable) {
  loadMyTasks();
}

async function loadMyTasks() {
  try {
    const response = await fetch(`${API}/tasks/my`, {
      headers: authHeaders(),
    });

    const tasks = await response.json();

    myTaskTable.innerHTML = "";

    tasks.forEach((task) => {
      myTaskTable.innerHTML += `
<tr>

<td>
${task.task}
</td>

<td>
${task.department}
</td>

<td>
${task.status || "Pending"}
</td>

<td>
${new Date(task.created_at).toLocaleDateString()}
</td>

<td>

<a href=
"task-details.html?id=${task.id}">
View
</a>

</td>

</tr>
`;
    });
  } catch (err) {
    console.log(err);
  }
}

// =======================
// LOAD TASK DETAILS
// =======================

const params = new URLSearchParams(window.location.search);

const taskId = params.get("id");

if (taskId) {
  loadTaskDetails();
}

async function loadTaskDetails() {
  try {
    const response = await fetch(`${API}/tasks/${taskId}`, {
      headers: authHeaders(),
    });

    const data = await response.json();

    document.getElementById("taskTitle").innerText = data.task.task;

    document.getElementById("department").innerText = data.task.department;

    document.getElementById("status").innerText = data.task.status || "Pending";

    // loadHistory(data.history);

    // loadComments(data.comments);
    loadActivity(data.history, data.comments);
  } catch (err) {
    console.log(err);
  }
}
// ==================================
// Load histroy and comments together
// ==================================
function loadActivity(history, comments) {
  const feed = document.getElementById("activityFeed");

  if (!feed) return;

  feed.innerHTML = "";

  history.forEach((item) => {
    const commentObj = comments.find(
      (c) =>
        c.commented_by === item.updated_by &&
        Math.abs(new Date(c.created_at) - new Date(item.created_at)) < 60000,
    );

    let badgeClass = "status-started";

    if (item.status === "Pending") {
      badgeClass = "status-pending";
    }

    if (item.status === "Completed") {
      badgeClass = "status-completed";
    }

    feed.innerHTML += `
    
    <div class="activity-item">

      <div class="activity-dot"></div>

      <div class="activity-header">

        <div class="activity-left">

          <div class="activity-user">
            ${item.updated_by}
          </div>

          <div class="activity-date">
            ${new Date(item.created_at).toLocaleString()}
          </div>

        </div>

        <div class="activity-status ${badgeClass}">
          ${item.status}
        </div>

      </div>

      <div class="activity-comment">

        <span class="activity-comment-label">
          Comment: 
        </span>

        ${
          commentObj?.comment
            ? commentObj.comment
            : '<span class="empty-comment">No comment added</span>'
        }

      </div>

    </div>

    `;
  });
}

// =======================
// HISTORY
// =======================

// function loadHistory(history) {
//   const table = document.getElementById("historyTable");

//   if (!table) return;

//   table.innerHTML = "";

//   history.forEach((item) => {
//     table.innerHTML += `
// <tr>

// <td>
// ${new Date(item.created_at).toLocaleString()}
// </td>

// <td>
// ${item.status}
// </td>

// <td>
// ${item.updated_by}
// </td>

// </tr>
// `;
//   });
// }

// =======================
// COMMENTS
// =======================

// function loadComments(comments) {
//   const table = document.getElementById("commentTable");

//   if (!table) return;

//   table.innerHTML = "";

//   comments.forEach((item) => {
//     table.innerHTML += `
// <tr>

// <td>
// ${new Date(item.created_at).toLocaleString()}
// </td>

// <td>
// ${item.commented_by}
// </td>

// <td>
// ${item.comment}
// </td>

// </tr>
// `;
//   });
// }

// =======================
// Delete Tasks
// =======================

async function deleteTask(taskId) {
  if (!confirm("Delete this task?")) return;

  try {
    const response = await fetch(`${API}/tasks/${taskId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const result = await response.json();

    if (result.success) {
      alert("Task deleted");

      location.reload();
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert(err.message);
  }
}

// =======================
// UPDATE STATUS
// =======================

async function updateStatus() {
  const status = document.getElementById("statusSelect").value;

  const comment = document.getElementById("comment").value;

  if (!comment || !comment.trim()) {
    alert("Comment is mandatory");

    return;
  }

  try {
    const response = await fetch(`${API}/tasks/status/${taskId}`, {
      method: "PUT",

      headers: authHeaders(),

      body: JSON.stringify({
        status,

        comment,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert("Status Updated");

      location.reload();
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert(err.message);
  }
}
