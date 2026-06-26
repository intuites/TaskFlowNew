// C:\Users\Admin\Desktop\projects\TaskFlow\web\frontend\js\admin.js
const API = "http://localhost:5000/api";

/* ==========================
   LOAD DEPARTMENTS
========================== */

async function loadDepartments() {
  try {
    const response = await fetch(`${API}/users/departments`, {
      headers: authHeaders(),
    });

    const departments = await response.json();

    const select = document.getElementById("department");

    if (!select) return;

    select.innerHTML = '<option value="">Select Department</option>';

    departments.forEach((dept) => {
      select.innerHTML += `
        <option value="${dept}">
          ${dept}
        </option>
      `;
    });
  } catch (err) {
    console.log(err);
  }
}

/* ==========================
   LOAD USERS
========================== */

async function loadUsers() {
  try {
    const department = document.getElementById("department").value;

    if (!department) return;

    const response = await fetch(`${API}/users/department/${department}`, {
      headers: authHeaders(),
    });

    const users = await response.json();

    const userSelect = document.getElementById("userSelect");

    if (!userSelect) return;

    userSelect.innerHTML = '<option value="">Select User</option>';

    users.forEach((user) => {
      userSelect.innerHTML += `
        <option value="${user.id}">
          ${user.username || user.email}
        </option>
      `;
    });
  } catch (err) {
    console.log(err);
  }
}

/* ==========================
   CREATE TASK
========================== */

const taskForm = document.getElementById("taskForm");

if (taskForm) {
  taskForm.addEventListener("submit", createTask);
}

async function createTask(e) {
  e.preventDefault();

  try {
    const response = await fetch(`${API}/tasks/create`, {
      method: "POST",

      headers: authHeaders(),

      body: JSON.stringify({
        department: document.getElementById("department").value,

        userId: document.getElementById("userSelect").value,

        task: document.getElementById("task").value,

        reminder_frequency: document.getElementById("reminder").value,

        // reminder_interval_days: document.getElementById("customDays").value,
        reminder_interval_days: document.getElementById("customDays").value
          ? parseInt(document.getElementById("customDays").value)
          : null,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert("Task Created Successfully");

      window.location.href = "admin-dashboard.html";
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert(err.message);
  }
}

/*================================
Delete Tasks
================================== */

async function deleteTask(taskId) {
  const confirmed = confirm("Are you sure you want to delete this task?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${API}/tasks/${taskId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const result = await response.json();

    if (result.success) {
      alert("Task deleted");

      loadTasks();
    } else {
      alert(result.message);
    }
  } catch (err) {
    alert(err.message);
  }
}

/* ==========================
   ALL TASKS
========================== */

const taskTable = document.getElementById("taskTable");

if (taskTable) {
  loadTasks();
}

async function loadTasks() {
  const response = await fetch(`${API}/tasks/all`, {
    headers: authHeaders(),
  });

  const tasks = await response.json();

  taskTable.innerHTML = "";

  tasks.forEach((task) => {
    // taskTable.innerHTML += `
    //   <tr>
    //     <td>${task.task || ""}</td>
    //     <td>${task.department || ""}</td>
    //     <td>${task.person || ""}</td>
    //     <td>${task.status || "Pending"}</td>
    //     <td>${new Date(task.created_at).toLocaleDateString()}</td>
    //     <td>
    //       <a href="task-details.html?id=${task.id}">
    //         View
    //       </a>
    //     </td>
    //   </tr>
    // `;
    const isAdmin = localStorage.getItem("role") === "admin";

    taskTable.innerHTML += `
  <tr>
    <td>${task.task || ""}</td>
    <td>${task.department || ""}</td>
    <td>${task.person || ""}</td>
    <td>${task.status || "Pending"}</td>
    <td>${new Date(task.created_at).toLocaleDateString()}</td>

    <td>
      <a href="task-details.html?id=${task.id}">
        View
      </a>

      ${
        isAdmin
          ? `
          <button
            onclick="deleteTask('${task.id}')"
            style="
              margin-left:10px;
              background:#dc2626;
              color:white;
            "
          >
            Delete
          </button>
          `
          : ""
      }
    </td>
  </tr>
`;
  });
}
// for only modal departments

/* ==========================
   DEPARTMENT MODAL CRUD
========================== */

// function openDepartmentModal() {
//   document.getElementById("departmentModal").style.display = "block";

//   loadDepartmentList();
// }

function openDepartmentModal() {
  document.getElementById("departmentModal").style.display = "flex";
  loadDepartmentList();
}

function closeDepartmentModal() {
  document.getElementById("departmentModal").style.display = "none";
}

async function loadDepartmentList() {
  try {
    const response = await fetch(`${API}/departments`, {
      headers: authHeaders(),
    });

    const departments = await response.json();

    const table = document.getElementById("departmentTable");

    if (!table) return;

    table.innerHTML = "";

    departments.forEach((dep) => {
      table.innerHTML += `
        <tr>

          <td>${dep.name}</td>

          <td>

            <button
              onclick="editDepartment('${dep.id}','${dep.name}')"
            >
              Edit
            </button>

            <button
              style="background:#dc2626;margin-left:8px;"
              onclick="deleteDepartment('${dep.id}')"
            >
              Delete
            </button>

          </td>

        </tr>
      `;
    });
  } catch (err) {
    console.log(err);
  }
}

async function createDepartment() {
  const name = document.getElementById("departmentName").value.trim();

  if (!name) {
    alert("Enter Department Name");
    return;
  }

  try {
    const response = await fetch(`${API}/departments`, {
      method: "POST",

      headers: authHeaders(),

      body: JSON.stringify({
        name,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return alert(result.message);
    }

    document.getElementById("departmentName").value = "";

    loadDepartmentList();

    loadDepartments();
  } catch (err) {
    alert(err.message);
  }
}

async function editDepartment(id, oldName) {
  const name = prompt("Update Department Name", oldName);

  if (!name) return;

  try {
    const response = await fetch(`${API}/departments/${id}`, {
      method: "PUT",

      headers: authHeaders(),

      body: JSON.stringify({
        name,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return alert(result.message);
    }

    loadDepartmentList();

    loadDepartments();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteDepartment(id) {
  if (!confirm("Delete Department?")) {
    return;
  }

  try {
    const response = await fetch(`${API}/departments/${id}`, {
      method: "DELETE",

      headers: authHeaders(),
    });

    const result = await response.json();

    if (!result.success) {
      return alert(result.message);
    }

    loadDepartmentList();

    loadDepartments();
  } catch (err) {
    alert(err.message);
  }
}

/* ==========================
   EVENTS
========================== */

const departmentSelect = document.getElementById("department");

if (departmentSelect) {
  departmentSelect.addEventListener("change", loadUsers);

  loadDepartments();
}
