if (!sessionStorage.getItem("loggedIn")) {
  localStorage.removeItem("loggedIn");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  window.location.replace("/login.html");
} else {
  document.body.style.visibility = "visible";
}
  let currentType = "today";
  let editId = null;
  let highlightedLeadId = null;
let allLeads = [];
let currentData = [];
let selectedDateFilter = "All";
let selectedQuickFilter = "All";
let selectedUserFilter = "All";
let selectedProductFilter = "All";

let currentPage = 1;
const leadsPerPage = 10;

const tableBody = document.getElementById("tableBody");
const todayTable = document.getElementById("todayTable");

async function addLead() {
  const phone = document.getElementById("phone").value;
  console.log("Add button clicked");

if (!/^[0-9]{10}$/.test(phone)) {
  alert("Enter valid 10 digit phone number");
  return;
}
  const data = {
    
    customerName: document.getElementById("customerName").value,
    clientName: document.getElementById("customerName").value,
    phone: "+91" + phone,
email: document.getElementById("email").value.trim(),
company: document.getElementById("company").value,
    product: document.getElementById("product").value,
    status: document.getElementById("status").value,
    nextFollowUp: document.getElementById("date").value,
    notes: document.getElementById("notes").value,
    createdBy: sessionStorage.getItem("username")
  };

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
  alert("Enter valid Email ID");
  return;
}

  // required validation
  if (
  !data.customerName.trim() ||
  !data.phone.trim() ||
  !data.company.trim() ||
  !data.product.trim() ||
  !data.status.trim() ||
  !data.nextFollowUp
) {
  alert("All fields are required!");
  return;
}
  // Duplicate
  const exists = allLeads.some(l => l.phone === data.phone);

if (!editId && exists) {
  alert("This phone number already exists!");
  return;
}

  //  edit mode
  let leadToHighlight = editId;
let result = null;

  if (editId) {

    await fetch("/update-lead/" + editId, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    username: sessionStorage.getItem("username"),
    role: sessionStorage.getItem("role")
  },
  body: JSON.stringify(data)
});

    editId = null;   // reset

  } else {

    // normal add

    data.lastFollowUp = new Date().toISOString().split("T")[0];
    
    const res = await fetch("/add-lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});

const text = await res.text();   // first read as text

console.log("RAW RESPONSE:", text);

try {
  result = JSON.parse(text);
} catch (e) {
  console.error("NOT JSON ERROR:", text);
  alert("Server error (not JSON)");
  return;
}

console.log("PARSED:", result);
  }

  if (result && result.data && result.data._id) {
  leadToHighlight = result.data._id;
}

highlightedLeadId = leadToHighlight;

clearForm();

await loadAll();

showToast("Lead added successfully");

}
function startEdit(id){
  editId = id;
  renderTable(allLeads);
}

function closePerformanceChart() {
  document.getElementById("teamChartBox").style.display = "none";
}

let overviewChart;

function loadOverviewChart(leads) {

  let pending = 0;
  let completed = 0;
  let overdue = 0;
  let cancelled = 0;

  const today = new Date().toISOString().split("T")[0];

  leads.forEach(l => {

    if (l.status === "Closed Won") {
      completed++;
    } 
    else if (l.status === "Closed Lost") {
      cancelled++;
    } 
    else if (l.nextFollowUp && l.nextFollowUp < today) {
      overdue++;
    } 
    else {
      pending++;
    }

  });

  const total = pending + completed + overdue + cancelled;

  // Destroy old chart
  if (overviewChart) overviewChart.destroy();

  const centerTextPlugin = {
  id: "centerText",
  beforeDraw(chart) {
    const { width, height, ctx } = chart;

    ctx.save();
    ctx.font = "bold 20px Segoe UI";
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total, width / 2, height / 2 - 8);

    ctx.font = "12px Segoe UI";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Total", width / 2, height / 2 + 12);
    ctx.restore();
  }
};

overviewChart = new Chart(document.getElementById("overviewChart"), {
  type: "doughnut",
  data: {
    labels: ["Pending", "Completed", "Overdue", "Lost"],
    datasets: [{
      data: [pending, completed, overdue, cancelled],
      backgroundColor: [
        "#2563eb",
        "#16a34a",
        "#f59e0b",
        "#ef4444"
      ]
    }]
  },
  options: {
    cutout: "70%",
    plugins: {
      legend: { display: false }
    }
  },
  plugins: [centerTextPlugin]
});

  // 🔥 Custom Legend (like your image)
  document.getElementById("overviewLegend").innerHTML = `
    ${legendItem("Pending", pending, total, "#2563eb")}
    ${legendItem("Completed", completed, total, "#16a34a")}
    ${legendItem("Overdue", overdue, total, "#f59e0b")}
    ${legendItem("Lost", cancelled, total, "#ef4444")}
  `;
}

function legendItem(label, value, total, color) {
  const percent = total ? Math.round((value / total) * 100) : 0;

  return `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; min-width:200px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="width:10px; height:10px; background:${color}; border-radius:50%; display:inline-block;"></span>
        ${label}
      </div>
      <div>${value} (${percent}%)</div>
    </div>
  `;
}
function todayYMD() {
  return new Date().toISOString().split("T")[0];
}

function isOverdue(l) {
  const status = (l.status || "").trim();

  return (
    l.nextFollowUp &&
    l.nextFollowUp < todayYMD() &&
    status !== "Closed Won" &&
    status !== "Closed Lost"
  );
}

function formatDate(dateStr) {

  const [y, m, d] = dateStr.split("-");

  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
} 

function applyQuickFilter(type) {
  selectedQuickFilter = type;
  currentPage = 1;
  applyAllFilters();
}

function exportToExcel() {

  const data = allLeads.map(l => ({
  "Client Name": l.customerName || l.clientName || "",

    "Phone": l.phone || "",

      "Email": l.email || "",

    "Company": l.company || "",

"Product": l.product || "",

"Last Follow-up":
      l.lastFollowUp
        ? new Date(l.lastFollowUp).toLocaleDateString()
        : new Date().toLocaleDateString(),

    "Next Follow-up":
      l.nextFollowUp
        ? new Date(l.nextFollowUp).toLocaleDateString()
        : "",

        "Notes": l.notes || "",

    "Status": l.status || "",

      "Created By": l.createdBy || "Unknown"

  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  XLSX.writeFile(workbook, "Cloud Tech All Leads.xlsx");
}
function getStatusClass(status) {
  if (status === "In Progress") return "follow";
  if (status === "Interested") return "interested";
  if (status === "Closed Won") return "closed";
  if (status === "Closed Lost") return "lost";
  return "";
}

function filterByProduct(product) {
  selectedProductFilter = product;
  currentPage = 1;
  applyAllFilters();
}

function renderTable(data) {
  tableBody.innerHTML = "";
  currentData = data;
  data = [...data].reverse();

  const emptyRow = document.getElementById("allEmpty");
  if (data.length === 0) {
  emptyRow.style.display = "table-row";
} else {
  emptyRow.style.display = "none";
}

const start = (currentPage - 1) * leadsPerPage;
const end = start + leadsPerPage;

const paginatedData = data.slice(start, end);

paginatedData.forEach(l => {

const highlightClass =
  l._id === highlightedLeadId ? "highlight-row" : "";
    tableBody.innerHTML += `
<tr class="${highlightClass}" id="lead-${l._id}">
  <td>${l.customerName || l.clientName || ""}</td>
  <td>${l.phone || ""}</td>
  <td>${l.email || ""}</td>
  <td>${l.company || ""}</td>
  <td>${l.product || ""}</td>
  <td>${l.lastFollowUp ? formatDate(l.lastFollowUp) : ""}</td>

  <td>
    ${l.nextFollowUp ? formatDate(l.nextFollowUp) : ""}
    ${isOverdue(l) ? `<div style="color:red; font-size:12px;">Overdue</div>` : ""}
  </td>
  <td> <div class="notes-cell">  ${l.notes || ""}</div></td>

  <td><span class="status ${getStatusClass(l.status)}">${l.status || ""}</span></td>

  <td>👤 ${l.createdBy || "Unknown"}</td>

  <td class="actions-cell">
  <button onclick="editLead('${l._id}')" class="action-btn edit-btn">
  <i data-lucide="pencil"></i>
</button>

<button onclick="deleteLead('${l._id}')" class="action-btn delete-btn">
  <i data-lucide="trash-2"></i>
</button>
</td>
</tr>
`;
  });
  renderPagination(data.length);
  lucide.createIcons();
}

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / leadsPerPage);

  let html = `
  <button onclick="prevPage()">Prev</button>

  <span style="
    font-weight:400;
    font-size:15px;
  ">
    Page ${currentPage} of ${totalPages}
  </span>

  <button onclick="nextPage()">Next</button>
`;

  document.getElementById("pagination").innerHTML = html;
}

function nextPage() {
  const totalPages = Math.ceil(currentData.length / leadsPerPage);

  if (currentPage < totalPages) {
    currentPage++;
    renderTable(currentData);
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable(currentData);
  }
}

function setType(type){
  currentType = type;
  loadPerformance(type);
}

function searchLeads() {
  currentPage = 1;
  applyAllFilters();
}

async function openCreateUser() {

  const username = prompt("Enter Username");

  if (!username) return;

  const password = prompt("Enter Password");

  if (!password) return;

  const res = await fetch("/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  const data = await res.json();

  if (data.success) {
    alert("User created successfully");
  } else {
    alert(data.message || "Error");
  }
}

async function openResetPassword() {
  const newPassword = prompt("Enter New Password");

  if (!newPassword) return;

  try {
    const res = await fetch("/reset-password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        username: sessionStorage.getItem("username")
      },
      body: JSON.stringify({
        newPassword: newPassword
      })
    });

    const data = await res.json();

    if (data.success) {
      alert("Password reset successfully. Please login again.");
      sessionStorage.clear();
localStorage.clear();
      window.location.href = "/login.html";
    } else {
      alert(data.message || "Password reset failed");
    }

  } catch (error) {
    alert("Server error. Password not reset.");
    console.error(error);
  }
}

async function deleteMyAccount() {

  const confirmDelete = confirm(
    "Delete account permanently? All leads will also be deleted."
  );

  if (!confirmDelete) return;

  const res = await fetch("/delete-account", {
    method: "DELETE",
    headers: {
      username: sessionStorage.getItem("username")
    }
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  sessionStorage.clear();
localStorage.clear();
  window.location.href = "/login.html";
}

function logout() {
  sessionStorage.clear();
  localStorage.clear();
  window.location.replace("/login.html");
}

// 📅 DATE FILTER
function filterByDate(type) {
  selectedDateFilter = type;
  currentPage = 1;
  applyAllFilters();
}
  
// 👤 USER FILTER
function filterByUser(user) {
  selectedUserFilter = user;
  currentPage = 1;
  applyAllFilters();
}
function applyAllFilters() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let filtered = [...allLeads];

  // USER FILTER
  if (selectedUserFilter !== "All") {
    filtered = filtered.filter(l =>
      (l.createdBy || "") === selectedUserFilter
    );
  }

  // PRODUCT FILTER
if (selectedProductFilter !== "All") {
  filtered = filtered.filter(l =>
    (l.product || "") === selectedProductFilter
  );
}
  // SEARCH FILTER
  const searchInput = document.getElementById("searchInput");
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";

  if (searchValue) {
    filtered = filtered.filter(l =>
      (l.customerName || l.clientName || "").toLowerCase().includes(searchValue) ||
      (l.phone || "").toLowerCase().includes(searchValue) ||
      (l.company || "").toLowerCase().includes(searchValue) ||
(l.product || "").toLowerCase().includes(searchValue) ||
(l.notes || "").toLowerCase().includes(searchValue)
    );
  }


  // DATE FILTER
  if (selectedDateFilter === "today") {
  filtered = filtered.filter(l => l.lastFollowUp === todayStr);
}

  if (selectedDateFilter === "week") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    filtered = filtered.filter(l => {
      if (!l.lastFollowUp) return false;

const d = new Date(l.lastFollowUp);
      d.setHours(0, 0, 0, 0);

      return d >= weekStart && d <= today;
    });
  }

  if (selectedDateFilter === "month") {
    filtered = filtered.filter(l => {
      if (!l.lastFollowUp) return false;

const d = new Date(l.lastFollowUp);

      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    });
  }

  // QUICK FILTER
  if (selectedQuickFilter === "overdue") {
    filtered = filtered.filter(l => isOverdue(l));
  }

  if (selectedQuickFilter === "today") {
    filtered = filtered.filter(l => l.nextFollowUp === todayStr);
  }

  if (selectedQuickFilter === "closedWeek") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    filtered = filtered.filter(l => {
      if (l.status !== "Closed Won") return false;
      if (!l.nextFollowUp) return false;

      const d = new Date(l.nextFollowUp);
      d.setHours(0, 0, 0, 0);

      return d >= weekStart && d <= today;
    });
  }

  if (selectedQuickFilter === "lost") {
    filtered = filtered.filter(l => l.status === "Closed Lost");
  }
if (
  selectedQuickFilter === "In Progress" ||
  selectedQuickFilter === "Interested" ||
  selectedQuickFilter === "Closed Won" ||
  selectedQuickFilter === "Closed Lost"
) {
  filtered = filtered.filter(
    l => l.status === selectedQuickFilter
  );
}
  currentData = filtered;
  renderTable(filtered);
}


function updatePerformanceSummary(type, user, counts) {
  const summaryBox = document.getElementById("performanceSummary");

  if (user === "All") {
    summaryBox.style.display = "none";
    summaryBox.innerHTML = "";
    return;
  }

  const inProgress = counts["In Progress"] || 0;
  const interested = counts["Interested"] || 0;
  const closedWon = counts["Closed Won"] || 0;
  const closedLost = counts["Closed Lost"] || 0;

  const total = inProgress + interested + closedWon + closedLost;

  function percent(value) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  summaryBox.style.display = "grid";
  summaryBox.style.gridTemplateColumns = "repeat(5, 1fr)";
  summaryBox.style.gap = "10px";

  summaryBox.innerHTML = `
    <div>Total<br><span style="font-size:22px;">${total}</span></div>
    <div style="color:#f59e0b;">In Progress<br><span style="font-size:22px;">${percent(inProgress)}%</span></div>
    <div style="color:#2563eb;">Interested<br><span style="font-size:22px;">${percent(interested)}%</span></div>
    <div style="color:#16a34a;">Closed Won<br><span style="font-size:22px;">${percent(closedWon)}%</span></div>
    <div style="color:#dc2626;">Closed Lost<br><span style="font-size:22px;">${percent(closedLost)}%</span></div>
  `;
}


let performanceChart;

async function loadPerformance(type) {
  const selectedUser = document.getElementById("chartUserFilter").value;
  const title = document.getElementById("teamPerformanceTitle");

if (title) {
  title.innerText = selectedUser === "All"
    ? "Team Performance"
    : `${selectedUser} Performance`;
}

  const res = await fetch(`/performance?type=${type}&user=${selectedUser}`, {
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  const data = await res.json();

  if (performanceChart) performanceChart.destroy();

  function getCount(obj, status) {
    if (!obj) return 0;
    return obj[status] || 0;
  }

  let labels = [];
  let totalLeadsData = [];
  let totalWonData = [];

  if (type === "year") {
    labels = data.map(d => d.month);

    totalLeadsData = data.map(d =>
      getCount(d, "In Progress") +
      getCount(d, "Interested") +
      getCount(d, "Closed Won") +
      getCount(d, "Closed Lost")
    );

    totalWonData = data.map(d =>
      getCount(d, "Closed Won")
    );

  } else {
    let users = Object.keys(data);

    if (selectedUser !== "All") {
      users = users.filter(u => u === selectedUser);
    }

    labels = users;

    totalLeadsData = users.map(u =>
      getCount(data[u], "In Progress") +
      getCount(data[u], "Interested") +
      getCount(data[u], "Closed Won") +
      getCount(data[u], "Closed Lost")
    );

    totalWonData = users.map(u =>
      getCount(data[u], "Closed Won")
    );
  }

  performanceChart = new Chart(document.getElementById("multiBarChart"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Leads",
          data: totalLeadsData,
          backgroundColor: "#2563eb"
        },
        {
          label: "Total Won",
          data: totalWonData,
          backgroundColor: "#16a34a"
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

  
function editLead(id) {
  const lead = allLeads.find(l => l._id === id);

  if (!lead) return;

  document.getElementById("customerName").value = lead.customerName || lead.clientName || "";
  document.getElementById("phone").value = (lead.phone || "").replace("+91", "");
document.getElementById("email").value = lead.email || "";
document.getElementById("company").value = lead.company || "";
  document.getElementById("product").value = lead.product || "";
  document.getElementById("status").value = lead.status || "";
  document.getElementById("date").value = lead.nextFollowUp || "";
  document.getElementById("notes").value = lead.notes || "";
  document.getElementById("addLeadSection").scrollIntoView({
  behavior: "smooth",
  block: "start"
});

  editId = id;   // 🔥 important
}

function clearForm() {
  document.getElementById("customerName").value = "";
  document.getElementById("phone").value = "";
document.getElementById("email").value = "";
document.getElementById("company").value = "";
  document.getElementById("product").selectedIndex = 0;
  document.getElementById("date").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("status").selectedIndex = 0;

  editId = null;
}

async function loadAll() {
  const res = await fetch("/leads", {
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  const leads = await res.json();

  loadOverviewChart(leads);

  // SET DATA
  allLeads = leads;
  updateEfficiencyBox(leads);
  populateChartUsers();

  // reset filters when dashboard loads
  selectedDateFilter = "All";
  selectedQuickFilter = "All";
  selectedUserFilter = "All";
  selectedProductFilter = "All";

  const search = document.getElementById("searchInput");
  if (search) search.value = "";

  const dateFilter = document.getElementById("dateFilter");
  if (dateFilter) dateFilter.value = "All";

  const quickFilter = document.getElementById("quickFilter");
  if (quickFilter) quickFilter.value = "All";

  const productFilter = document.getElementById("productFilter");
  if (productFilter) productFilter.value = "All";

  const userFilter = document.getElementById("userFilter");
  if (userFilter) userFilter.value = "All";

  currentPage = 1;
  currentData = allLeads;
  renderTable(allLeads);

  // TODAY DATE
  const todayDate = new Date().toISOString().split("T")[0];

  // TOTAL
  document.getElementById("totalLeads").innerText = leads.length;

  // OVERDUE
  const overdue = leads.filter(l => isOverdue(l));
  document.getElementById("overdueCount").innerText = overdue.length;

  // TODAY FOLLOW-UPS
  const todayLeads = leads.filter(l => {
    if (!l.nextFollowUp) return false;
    return new Date(l.nextFollowUp).toISOString().split("T")[0] === todayDate;
  });

  const todayEmpty = document.getElementById("todayEmpty");

  if (todayLeads.length === 0) {
    todayEmpty.style.display = "table-row";
  } else {
    todayEmpty.style.display = "none";
  }

  document.getElementById("todayCount").innerText = todayLeads.length;

  // CLOSED WON
  const closed = leads.filter(l => l.status === "Closed Won");
  document.getElementById("closedCount").innerText = closed.length;

  // CLOSED LOST
  const lost = leads.filter(l => l.status === "Closed Lost");
  document.getElementById("lostCount").innerText = lost.length;

  // TODAY TABLE
  todayTable.innerHTML = "";

  todayLeads.forEach(l => {
    todayTable.innerHTML += `
      <tr>
        <td>${l.customerName || l.clientName || ""}</td>
        <td>${l.phone || ""}</td>
        <td>${l.email || ""}</td>
        <td>${l.company || ""}</td>
        <td>${l.notes || ""}</td>
        <td>${l.createdBy || ""}</td>
      </tr>`;
  });

  // Highlight newly added/edited lead
  setTimeout(() => {
    if (highlightedLeadId) {
      const row = document.getElementById(`lead-${highlightedLeadId}`);

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

      setTimeout(() => {
        const row = document.getElementById(`lead-${highlightedLeadId}`);

        if (row) {
          row.classList.remove("highlight-row");
        }

        highlightedLeadId = null;
      }, 1000);
    }
  }, 300);
}

async function loadDashboardPendingTaskSummary() {
  const box = document.getElementById("dashboardPendingTaskSummaryBox");

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

function populateChartUsers() {
  const users = [...new Set(allLeads.map(l => l.createdBy || "Unknown"))];

  // chart dropdown
  const chartDropdown = document.getElementById("chartUserFilter");
  if (chartDropdown) {
    chartDropdown.innerHTML = `<option value="All">All Users</option>`;

    users.forEach(u => {
      chartDropdown.innerHTML += `<option value="${u}">${u}</option>`;
    });
  }

  // admin-only lead filter dropdown
  const userFilter = document.getElementById("userFilter");
  const role = sessionStorage.getItem("role");
  const userFilterGroup = document.getElementById("userFilterGroup");

  if (userFilter) {
    if (role === "admin") {
      if (userFilterGroup) userFilterGroup.style.display = "flex";
      userFilter.style.display = "block";
      userFilter.innerHTML = `<option value="All">All Users</option>`;

      users.forEach(u => {
        userFilter.innerHTML += `<option value="${u}">${u}</option>`;
      });
    } else {
      if (userFilterGroup) userFilterGroup.style.display = "none";
      userFilter.style.display = "none";
      selectedUserFilter = sessionStorage.getItem("username") || "All";
    }
  }
}

async function saveStatus(id){
  const newStatus = document.getElementById(`editStatus-${id}`).value;

  await fetch("/update-lead/" + id, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ status: newStatus })
  });
  showToast("Status Updated");
  // highlight row
  const row = document.querySelector(`button[onclick="saveStatus('${id}')"]`).closest("tr");
  row.classList.add("updated");

  setTimeout(() => {
    row.classList.remove("updated");
  }, 600);

  editId = null;
  loadAll();
}

function updateEfficiencyBox(leads) {
  const box = document.getElementById("efficiencyBox");
  if (!box) return;

  const userStats = {};

  leads.forEach(l => {
    const user = l.createdBy || "Unknown";

    if (!userStats[user]) {
      userStats[user] = {
        total: 0,
        won: 0
      };
    }

    userStats[user].total++;

    if ((l.status || "").trim() === "Closed Won") {
      userStats[user].won++;
    }
  });

  let html = `<div class="eff-title">User Efficiency</div>`;

  Object.keys(userStats).forEach(user => {
    const total = userStats[user].total;
    const won = userStats[user].won;
    const percent = total ? Math.round((won / total) * 100) : 0;

    html += `
      <button class="eff-item" onclick="openUserPerformance('${user}')">
        <span>${user}</span>
        <em>${percent}%</em>
      </button>
    `;
  });

  box.innerHTML = html;
}

function resetFilters() {
  selectedDateFilter = "All";
  selectedQuickFilter = "All";
  selectedUserFilter = "All";
  selectedProductFilter = "All";

  const search = document.getElementById("searchInput");
  if (search) search.value = "";

  const quick = document.getElementById("quickFilter");
  if (quick) quick.value = "All";

  const userFilter = document.getElementById("userFilter");
  if (userFilter) userFilter.value = "All";

  const productFilter = document.getElementById("productFilter");
  if (productFilter) productFilter.value = "All";

  const selects = document.querySelectorAll(".filter-bar select");
  selects.forEach(s => s.selectedIndex = 0);

  currentPage = 1;
  currentData = allLeads;
  renderTable(allLeads);

  showToast("Filters Reset");
}
function toggleProfileMenu(event) {
  event.stopPropagation();

  const menu = document.getElementById("profileMenu");
  if (!menu) return;

  menu.classList.toggle("show");
}

document.addEventListener("click", function () {
  const menu = document.getElementById("profileMenu");
  if (menu) {
    menu.classList.remove("show");
  }
});

function togglePerformanceChart() {
  openUserPerformance("All");
}
function openUserPerformance(user) {
  const box = document.getElementById("teamChartBox");
  const dropdown = document.getElementById("chartUserFilter");
  const title = document.getElementById("teamPerformanceTitle");

  if (!box || !dropdown) return;

  box.style.display = "block";

  dropdown.value = user;

  if (title) {
    title.innerText = user === "All"
      ? "Team Performance"
      : `${user} Performance`;
  }

  currentType = "today";
  loadPerformance("today");

  box.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

  async function deleteLead(id) {

  if (!confirm("Delete this lead?")) return;

  const res = await fetch("/delete-lead/" + id, {
    method: "DELETE",
    headers: {
      username: sessionStorage.getItem("username"),
      role: sessionStorage.getItem("role")
    }
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message || "Delete not allowed");
    return;
  }

  showToast("Lead deleted successfully");
  loadAll();
}
document.addEventListener("DOMContentLoaded", () => {

  const username = sessionStorage.getItem("username") || "User";
  const role = sessionStorage.getItem("role") || "employee";

  const profileUsername = document.getElementById("profileUsername");
  const profileRole = document.getElementById("profileRole");
  const profileAvatar = document.getElementById("profileAvatar");

  if (profileUsername) {
    profileUsername.innerText = username;
  }

  if (profileRole) {
    profileRole.innerText = role === "admin" ? "Admin" : "Employee";
  }

  if (role === "admin" && profileAvatar) {
    profileAvatar.classList.add("admin-avatar");
  }

  if (window.lucide) {
    lucide.createIcons();
  }

  loadAll();
  loadDashboardPendingTaskSummary();
});
