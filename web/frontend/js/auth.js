// // frontend/js/auth.js
const API_URL = "http://localhost:5000/api";

// =======================
// LOGIN
// =======================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      console.log("LOGIN RESPONSE:", result);

      if (!result.success) {
        document.getElementById("error").innerText = result.message;

        return;
      }

      localStorage.setItem("token", result.token);

      localStorage.setItem("role", result.role);

      localStorage.setItem("email", result.email);

      console.log("TOKEN SAVED:", localStorage.getItem("token"));

      if (result.role === "admin") {
        window.location.href = "admin-dashboard.html";
      } else {
        window.location.href = "my-tasks.html";
      }
    } catch (err) {
      console.error(err);

      document.getElementById("error").innerText = err.message;
    }
  });
}

// =======================
// HELPERS
// =======================

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();

  console.log("CURRENT TOKEN:", token);

  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
}

function logout() {
  localStorage.clear();

  window.location.href = "login.html";
}

// const API_URL = "http://localhost:5000/api";

// const loginForm = document.getElementById("loginForm");

// if (loginForm) {
//   loginForm.addEventListener("submit", async function (e) {
//     e.preventDefault();

//     const email = document.getElementById("email").value;

//     const password = document.getElementById("password").value;

//     try {
//       const response = await fetch(`${API_URL}/auth/login`, {
//         method: "POST",

//         headers: {
//           "Content-Type": "application/json",
//         },

//         body: JSON.stringify({
//           email,
//           password,
//         }),
//       });

//       const result = await response.json();

//       if (!result.success) {
//         document.getElementById("error").innerText = result.message;

//         return;
//       }

//       localStorage.setItem("token", result.token);

//       localStorage.setItem("role", result.role);

//       localStorage.setItem("email", result.email);

//       if (result.role === "admin") {
//         window.location.href = "admin-dashboard.html";
//       } else {
//         window.location.href = "my-tasks.html";
//       }
//     } catch (err) {
//       document.getElementById("error").innerText = err.message;
//     }
//   });
// }

// // =======================
// // TOKEN HELPERS
// // =======================

// function getToken() {
//   return localStorage.getItem("token");
// }

// function logout() {
//   localStorage.clear();

//   window.location.href = "login.html";
// }

// function authHeaders() {
//   return {
//     "Content-Type": "application/json",

//     Authorization: "Bearer " + getToken(),
//   };
// }
