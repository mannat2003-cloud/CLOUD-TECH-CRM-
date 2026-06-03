if (!sessionStorage.getItem("loggedIn")) {
  localStorage.removeItem("loggedIn");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  window.location.replace("/login.html");
} else {
  document.body.style.visibility = "visible";
}

let allTasks = [];

const role = sessionStorage.getItem("role") || "employee";
const username = sessionStorage.getItem("username") || "";

document.addEventListener("DOMContentLoaded", () => {
  if (role === "admin") {
    document.getElementById("assignTaskSection").style.display = "block";
    document.getElementById("taskUserFilterGroup").style.display = "flex";
    loadEmployees();
  }

  loadTasks();

  if (window.lucide) {
    lucide.createIcons();
  }
});

async function loadEmployees() {
  const res = await fetch("/all-users");
  const users = await res.json();

  const assignDropdown = document.getElementById("taskAssignTo");
  const filterDropdown = document.getElementById("taskUserFilter");

  assignDropdown.innerHTML = `<option value="">Select Employee</option>`;
  filterDropdown.innerHTML = `<option value="All">All Employees</option>`;

  users
    .filter(u => u.role !== "admin")
    .forEach(u => {
      assignDropdown.innerHTML += `<option value="${u.username}">${u.username}</option>`;
      filterDropdown.innerHTML += `<option value="${u.username}">${u.username}</option>`;
    });
}

async function assignTask() {
  const phone = document.getElementById("taskPhone").value.trim();

  if (!/^[0-9]{10}$/.test(phone)) {
    alert("Enter valid 10 digit phone number");
    return;
  }

  const data = {
    clientName: document.getElementById("taskClientName").value.trim(),
    phone: phone,
    email: document.getElementById("taskEmail").value.trim(),
    product: document.getElementById("taskProduct").value,
    assignedTo: document.getElementById("taskAssignTo").value,
    priority: document.getElementById("taskPriority").value,
    nextFollowUp: document.getElementById("taskNextFollowUp").value,
    notes: document.getElementById("taskNotes").value.trim()
  };

  if (!data.clientName || !data.phone || !data.product || !data.assignedTo) {
    alert("Client Name, Phone, Product and Assign To are required");
    return;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    alert("Enter valid Email ID");
    return;
  }

  const res = await fetch("/assign-task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!result.success) {
    alert(result.message || "Task not assigned");
    return;
  }

  clearAssignForm();
  showToast("Task assigned successfully");
  loadTasks();
}

function clearAssignForm() {
  document.getElementById("taskClientName").value = "";
  document.getElementById("taskPhone").value = "";
  document.getElementById("taskEmail").value = "";
  document.getElementById("taskProduct").selectedIndex = 0;
  document.getElementById("taskAssignTo").selectedIndex = 0;
  document.getElementById("taskPriority").selectedIndex = 0;
  document.getElementById("taskNextFollowUp").value = "";
  document.getElementById("taskNotes").value = "";
}

async function loadTasks() {
  const res = await fetch("/assigned-tasks", {
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  allTasks = await res.json();

  updateTaskCards();
  renderTasks();
  loadPendingTaskSummary();
}

async function loadPendingTaskSummary() {
  const box = document.getElementById("pendingTaskSummaryBox");

  if (!box) return;

  const res = await fetch("/task-pending-summary", {
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  const data = await res.json();

  if (!data.success) {
    box.innerHTML = `<div class="pending-chip">Unable to load pending tasks</div>`;
    return;
  }

  if (data.type === "employee") {
    box.innerHTML = `
      <div class="pending-chip">
        👤 ${data.username} Pending Tasks = <b>${data.pendingCount}</b>
      </div>
    `;
    return;
  }

  const employees = Object.keys(data.summary);

  if (employees.length === 0) {
    box.innerHTML = `
      <div class="pending-chip">
        ✅ No pending tasks
      </div>
    `;
    return;
  }

  box.innerHTML = employees.map(emp => `
    <div class="pending-chip">
      👤 ${emp} Pending Tasks = <b>${data.summary[emp]}</b>
    </div>
  `).join("");
}

function updateTaskCards() {
  const today = new Date().toISOString().split("T")[0];

  const total = allTasks.length;

  const pending = allTasks.filter(t =>
    t.status !== "Closed Won" && t.status !== "Closed Lost"
  ).length;

  const won = allTasks.filter(t => t.status === "Closed Won").length;

  const overdue = allTasks.filter(t =>
    t.nextFollowUp &&
    t.nextFollowUp < today &&
    t.status !== "Closed Won" &&
    t.status !== "Closed Lost"
  ).length;

  document.getElementById("taskTotal").innerText = total;
  document.getElementById("taskPending").innerText = pending;
  document.getElementById("taskWon").innerText = won;
  document.getElementById("taskOverdue").innerText = overdue;
}

function renderTasks() {
  const tbody = document.getElementById("tasksTableBody");
  const empty = document.getElementById("taskEmpty");

  let data = [...allTasks];

  const search = document.getElementById("taskSearch").value.toLowerCase().trim();
  const statusFilter = document.getElementById("taskStatusFilter").value;
  const userFilter = document.getElementById("taskUserFilter")
    ? document.getElementById("taskUserFilter").value
    : "All";

  if (search) {
    data = data.filter(t =>
      (t.clientName || "").toLowerCase().includes(search) ||
      (t.phone || "").toLowerCase().includes(search) ||
      (t.email || "").toLowerCase().includes(search) ||
      (t.product || "").toLowerCase().includes(search) ||
      (t.company || "").toLowerCase().includes(search) ||
      (t.notes || "").toLowerCase().includes(search)
    );
  }

  if (statusFilter !== "All") {
    data = data.filter(t => t.status === statusFilter);
  }

  if (role === "admin" && userFilter !== "All") {
    data = data.filter(t => t.assignedTo === userFilter);
  }

  tbody.innerHTML = "";

  if (data.length === 0) {
    empty.style.display = "table-row";
  } else {
    empty.style.display = "none";
  }

  data.reverse().forEach(t => {
    tbody.innerHTML += `
      <tr>
        <td>${t.clientName || ""}</td>
        <td>${t.phone || ""}</td>
        <td>${t.email || ""}</td>
        <td>${t.product || ""}</td>
        <td>👤 ${t.assignedTo || ""}</td>
        <td><span class="status ${getTaskStatusClass(t.status)}">${t.status || ""}</span></td>
        <td>
          ${formatDateSafe(t.nextFollowUp)}
          ${isTaskOverdue(t) ? `<div style="color:red; font-size:12px;">Overdue</div>` : ""}
        </td>
        <td>${t.company || ""}</td>
        <td><div class="notes-cell">${t.notes || ""}</div></td>
        <td>${formatDateSafe(t.lastUpdated)}</td>
        <td class="actions-cell">
          <button onclick="openTaskUpdate('${t._id}')" class="action-btn edit-btn">
            <i data-lucide="pencil"></i>
          </button>
          ${
            role === "admin"
              ? `<button onclick="deleteTask('${t._id}')" class="action-btn delete-btn">
                  <i data-lucide="trash-2"></i>
                </button>`
              : ""
          }
        </td>
      </tr>
    `;
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function openTaskUpdate(id) {
  const task = allTasks.find(t => t._id === id);

  if (!task) return;

  document.getElementById("editTaskId").value = task._id;
  document.getElementById("updateCompany").value = task.company || "";
  document.getElementById("updateStatus").value = task.status || "Assigned";
  document.getElementById("updateNextFollowUp").value = task.nextFollowUp || "";
  document.getElementById("updateNotes").value = task.notes || "";

  document.getElementById("updateTaskSection").style.display = "block";

  document.getElementById("updateTaskSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveTaskUpdate() {
  const id = document.getElementById("editTaskId").value;

  if (!id) {
    alert("No task selected");
    return;
  }

  const data = {
    company: document.getElementById("updateCompany").value.trim(),
    status: document.getElementById("updateStatus").value,
    nextFollowUp: document.getElementById("updateNextFollowUp").value,
    notes: document.getElementById("updateNotes").value.trim()
  };

  if (!data.status) {
    alert("Please select status");
    return;
  }

  const res = await fetch("/update-task/" + id, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!result.success) {
    alert(result.message || "Task not updated");
    return;
  }

  document.getElementById("updateTaskSection").style.display = "none";
  clearUpdateForm();

  showToast("Task updated and added to dashboard");
  loadTasks();
}

function clearUpdateForm() {
  document.getElementById("editTaskId").value = "";
  document.getElementById("updateCompany").value = "";
  document.getElementById("updateStatus").selectedIndex = 0;
  document.getElementById("updateNextFollowUp").value = "";
  document.getElementById("updateNotes").value = "";
}

async function deleteTask(id) {
  if (!confirm("Delete this assigned task?")) return;

  const res = await fetch("/delete-task/" + id, {
    method: "DELETE",
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  const result = await res.json();

  if (!result.success) {
    alert(result.message || "Task not deleted");
    return;
  }

  showToast("Task deleted successfully");
  loadTasks();
}

function isTaskOverdue(t) {
  const today = new Date().toISOString().split("T")[0];

  return (
    t.nextFollowUp &&
    t.nextFollowUp < today &&
    t.status !== "Closed Won" &&
    t.status !== "Closed Lost"
  );
}

function getTaskStatusClass(status) {
  if (status === "Assigned") return "follow";
  if (status === "Contacted") return "interested";
  if (status === "In Progress") return "follow";
  if (status === "Interested") return "interested";
  if (status === "Closed Won") return "closed";
  if (status === "Closed Lost") return "lost";
  if (status === "Not Responding") return "lost";
  return "";
}

function formatDateSafe(dateStr) {
  if (!dateStr) return "";

  const parts = dateStr.split("-");

  if (parts.length !== 3) return dateStr;

  const [y, m, d] = parts;

  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function logout() {
  sessionStorage.clear();
  localStorage.clear();
  window.location.replace("/login.html");
}