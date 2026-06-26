// C:\Users\Admin\Desktop\projects\TaskFlow\web\frontend\js\users.js
const API = "http://localhost:5000/api";

const usersTable = document.getElementById("usersTable");

console.log("users management loaded");

if (usersTable) {
  loadUsers();
}

async function loadUsers() {
  try {
    console.log("Loading users...");

    const response = await fetch(`${API}/users`, {
      headers: authHeaders(),
    });

    const users = await response.json();

    console.log("Users API Response:", users);

    usersTable.innerHTML = "";

    users.forEach((user) => {
      usersTable.innerHTML += `
        <tr>
          <td>${user.username || ""}</td>
          <td>${user.email || ""}</td>
          <td>${user.department || ""}</td>
          <td>${new Date(user.created_at).toLocaleDateString()}</td>
          <td>
            <button onclick="deleteUser('${user.id}')">
              Delete
            </button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Load Users Error:", err);
  }
}

async function deleteUser(userId) {
  if (!confirm("Delete this user?")) return;

  try {
    const response = await fetch(`${API}/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const result = await response.json();

    if (result.success) {
      alert("User deleted");
      loadUsers();
    } else {
      alert(result.message);
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================
   CREATE USER
========================== */

const createUserForm = document.getElementById("createUserForm");

if (createUserForm) {
  createUserForm.addEventListener("submit", createUser);
}

async function createUser(e) {
  e.preventDefault();

  try {
    const response = await fetch(`${API}/users/create`, {
      method: "POST",

      headers: authHeaders(),

      body: JSON.stringify({
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        department: document.getElementById("department").value,
      }),
    });

    const result = await response.json();

    console.log(result);

    if (result.success) {
      alert("User Created Successfully");

      window.location.href = "users.html";
    } else {
      alert(result.message);
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}
// Load departments dynamically
async function loadDepartmentDropdown() {
  try {
    const response = await fetch(`${API}/departments`, {
      headers: authHeaders(),
    });

    const departments = await response.json();

    const select = document.getElementById("department");

    if (!select) return;

    select.innerHTML = '<option value="">Select Department</option>';

    departments.forEach((dep) => {
      select.innerHTML += `
        <option value="${dep.name}">
          ${dep.name}
        </option>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

loadDepartmentDropdown();
// const API = "http://localhost:5000/api";

// const form = document.getElementById("createUserForm");
// console.log("users.js loaded");

// if (form) {
//   form.addEventListener("submit", createUser);
// }

// async function createUser(e) {
//   e.preventDefault();

//   try {
//     const response = await fetch(`${API}/users/create`, {
//       method: "POST",

//       headers: authHeaders(),

//       body: JSON.stringify({
//         username: document.getElementById("username").value,

//         email: document.getElementById("email").value,

//         password: document.getElementById("password").value,

//         department: document.getElementById("department").value,
//       }),
//     });

//     const result = await response.json();

//     if (result.success) {
//       alert("User Created");

//       location.reload();
//     } else {
//       alert(result.message);
//     }
//   } catch (err) {
//     alert(err.message);
//   }
// }
