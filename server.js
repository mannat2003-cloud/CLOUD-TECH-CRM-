const express = require("express");
const app = express();
const mongoose = require("mongoose");

app.use(express.json());
app.use(express.static(__dirname));

/* ================= DB ================= */


mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));
const leadSchema = new mongoose.Schema({
  clientName: String,
  customerName: String,
  phone: String,
email: String,
company: String,
  product: String,
  status: String,
  lastFollowUp: String,
  nextFollowUp: String,
  notes: String,
  createdBy: String
});

leadSchema.index({ createdBy: 1 });
leadSchema.index({ nextFollowUp: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ phone: 1 });

const Lead = mongoose.model("Lead", leadSchema);

/* ================= TASKS ================= */

const taskSchema = new mongoose.Schema({
  clientName: String,
  phone: String,
  email: String,
  product: String,

  assignedTo: String,
  assignedBy: String,

  company: String,
  status: {
    type: String,
    default: "Assigned"
  },
  nextFollowUp: String,
  notes: String,

  priority: {
    type: String,
    default: "Normal"
  },

  assignedDate: String,
  lastUpdated: String,

  linkedLeadId: String
});

taskSchema.index({ assignedTo: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ nextFollowUp: 1 });

const Task = mongoose.model("Task", taskSchema);

/* ================= USERS ================= */
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String
});

const User = mongoose.model("User", userSchema);

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({
    username: new RegExp("^" + username.trim() + "$", "i"),
    password: password
  });

  if (user) {
    return res.json({
      success: true,
      username: user.username,
      role: user.role
    });
  }

  res.json({ success: false });
});

/* ================= ADD LEAD ================= */

app.post("/add-lead", async (req, res) => {
  try {

    req.body.status = req.body.status.trim();

    console.log("BODY:", req.body); // debug

    const lead = await Lead.create(req.body);

    res.json({ success: true, data: lead });
  } catch (err) {
    console.error("ADD ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ALL LEADS

app.get("/leads", async (req, res) => {

  const { username, role } = req.headers;
  console.log("USER:", username, "ROLE:", role);

  let data;

  if (role === "admin") {
    data = await Lead.find();
  } else {
    data = await Lead.find({ createdBy: username });
  }

  console.log("DATA COUNT:", data.length);

  res.json(data);
});

/* ================= UPDATE ================= */

app.put("/update-lead/:id", async (req, res) => {
  await Lead.findByIdAndUpdate(req.params.id, req.body);
  res.json({ success: true });
});


/* ================= DELETE ================= */

app.delete("/delete-lead/:id", async (req, res) => {
  const { username, role } = req.headers;

  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    return res.json({ success: false, message: "Lead not found" });
  }

  // Admin can delete anytime
  if (role === "admin") {
    await Lead.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  }

  // Employee can delete only own lead
  if (lead.createdBy !== username) {
    return res.json({
      success: false,
      message: "You can delete only your own lead"
    });
  }

  // Employee can delete only within 48 hours
const createdTime = lead._id.getTimestamp();
const now = new Date();
const diffHours = (now - createdTime) / (1000 * 60 * 60);

if (diffHours > 48) {
  return res.json({
    success: false,
    message: "Delete time expired after 48 hours. Please contact admin."
  });
}

  await Lead.findByIdAndDelete(req.params.id);

  res.json({ success: true });
});

/* ========= Create User ========== */

app.post("/create-user", async (req, res) => {
  const { username, password } = req.body;

  const exists = await User.findOne({
    username: new RegExp("^" + username.trim() + "$", "i")
  });

  if (exists) {
    return res.json({ success: false, message: "Username already exists" });
  }

  const totalUsers = await User.countDocuments();

  if (totalUsers >= 10) {
    return res.json({
      success: false,
      message: "Maximum user limit reached"
    });
  }


  await User.create({
    username: username.trim(),
    password,
    role: "employee"
  });

  res.json({ success: true });
});

app.get("/all-users", async (req, res) => {
  const users = await User.find({}, "username role");
  res.json(users);
});

/* ================= ASSIGNED TASKS ================= */

// Admin assign task
app.post("/assign-task", async (req, res) => {
  try {
    const { username, role } = req.headers;

    if (role !== "admin") {
      return res.json({
        success: false,
        message: "Only admin can assign tasks"
      });
    }

    const {
      clientName,
      phone,
      email,
      product,
      assignedTo,
      priority,
      nextFollowUp,
      notes
    } = req.body;

    if (!clientName || !phone || !product || !assignedTo) {
      return res.json({
        success: false,
        message: "Client name, phone, product and assigned employee are required"
      });
    }

    const task = await Task.create({
      clientName: clientName.trim(),
      phone: phone.startsWith("+91") ? phone : "+91" + phone,
      email: email || "",
      product,
      assignedTo,
      assignedBy: username,
      priority: priority || "Normal",
      nextFollowUp: nextFollowUp || "",
      notes: notes || "",
      status: "Assigned",
      assignedDate: new Date().toISOString().split("T")[0],
      lastUpdated: "",
      linkedLeadId: ""
    });

    res.json({ success: true, data: task });

  } catch (err) {
    console.error("ASSIGN TASK ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Get assigned tasks
app.get("/assigned-tasks", async (req, res) => {
  try {
    const { username, role } = req.headers;

    let tasks;

    if (role === "admin") {
      tasks = await Task.find();
    } else {
      tasks = await Task.find({ assignedTo: username });
    }

    res.json(tasks);

  } catch (err) {
    console.error("GET TASKS ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pending task count summary
app.get("/task-pending-summary", async (req, res) => {
  try {
    const { username, role } = req.headers;

    const pendingStatuses = [
      "Assigned",
      "Contacted",
      "In Progress",
      "Interested",
      "Not Responding"
    ];

    let tasks;

    if (role === "admin") {
      tasks = await Task.find({
        status: { $in: pendingStatuses }
      });
    } else {
      tasks = await Task.find({
        assignedTo: username,
        status: { $in: pendingStatuses }
      });
    }

    if (role !== "admin") {
      return res.json({
        success: true,
        type: "employee",
        username,
        pendingCount: tasks.length
      });
    }

    const summary = {};

    tasks.forEach(t => {
      const employee = t.assignedTo || "Unknown";
      summary[employee] = (summary[employee] || 0) + 1;
    });

    res.json({
      success: true,
      type: "admin",
      summary
    });

  } catch (err) {
    console.error("TASK SUMMARY ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Pending task count summary
app.get("/task-pending-summary", async (req, res) => {
  try {
    const { username, role } = req.headers;

    const pendingStatuses = [
      "Assigned",
      "Contacted",
      "In Progress",
      "Interested",
      "Not Responding"
    ];

    let tasks;

    if (role === "admin") {
      tasks = await Task.find({
        status: { $in: pendingStatuses }
      });
    } else {
      tasks = await Task.find({
        assignedTo: username,
        status: { $in: pendingStatuses }
      });
    }

    if (role !== "admin") {
      return res.json({
        success: true,
        type: "employee",
        username,
        pendingCount: tasks.length
      });
    }

    const summary = {};

    tasks.forEach(t => {
      const employee = t.assignedTo || "Unknown";

      if (!summary[employee]) {
        summary[employee] = 0;
      }

      summary[employee]++;
    });

    res.json({
      success: true,
      type: "admin",
      summary
    });

  } catch (err) {
    console.error("TASK SUMMARY ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Employee/Admin update task
app.put("/update-task/:id", async (req, res) => {
  try {
    const { username, role } = req.headers;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.json({
        success: false,
        message: "Task not found"
      });
    }

    if (role !== "admin" && task.assignedTo !== username) {
      return res.json({
        success: false,
        message: "You can update only your assigned task"
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const updateData = {
      company: req.body.company || "",
      status: req.body.status || "Assigned",
      nextFollowUp: req.body.nextFollowUp || "",
      notes: req.body.notes || "",
      lastUpdated: today
    };

    await Task.findByIdAndUpdate(req.params.id, updateData);

    // Auto create/update lead in main dashboard
    if (!task.linkedLeadId) {
      const newLead = await Lead.create({
        customerName: task.clientName,
        clientName: task.clientName,
        phone: task.phone,
        email: task.email,
        company: req.body.company || "",
        product: task.product,
        status: req.body.status || "In Progress",
        nextFollowUp: req.body.nextFollowUp || "",
        lastFollowUp: today,
        notes: req.body.notes || "",
        createdBy: task.assignedTo
      });

      await Task.findByIdAndUpdate(req.params.id, {
         ...updateData,
        linkedLeadId: newLead._id
      });

    } else {
      await Lead.findByIdAndUpdate(task.linkedLeadId, {
        customerName: task.clientName,
        clientName: task.clientName,
        phone: task.phone,
        email: task.email,
        company: req.body.company || "",
        product: task.product,
        status: req.body.status || "In Progress",
        nextFollowUp: req.body.nextFollowUp || "",
        lastFollowUp: today,
        notes: req.body.notes || "",
        createdBy: task.assignedTo
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Admin delete task
app.delete("/delete-task/:id", async (req, res) => {
  try {
    const { role } = req.headers;

    if (role !== "admin") {
      return res.json({
        success: false,
        message: "Only admin can delete tasks"
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE TASK ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/reset-password", async (req, res) => {
  const { username } = req.headers;
  const { newPassword } = req.body;

  if (!username) {
    return res.json({
      success: false,
      message: "User not logged in"
    });
  }

  await User.findOneAndUpdate(
    { username: new RegExp("^" + username.trim() + "$", "i") },
    { password: newPassword }
  );

  res.json({ success: true });
});

app.delete("/delete-account", async (req, res) => {
  const { username } = req.headers;

  if (username.toLowerCase() === "cloudtech") {
  return res.json({
    success: false,
    message: "Main admin account cannot be deleted"
  });
}
  await Lead.deleteMany({ createdBy: username });
  await User.deleteOne({ username: username });

  res.json({ success: true });
});


/* ================= TODAY FOLLOWUPS ================= */

app.get("/today-followups", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

const all = await Lead.find();

const data = all.filter(l => l.nextFollowUp === today);

  res.json(data);
});

  
/* ================== Chart ============== */

app.get("/performance", async (req, res) => {
  const { type, user } = req.query;

  const { username, role } = req.headers;

let data;

if (role === "admin") {
  data = await Lead.find();
} else {
  data = await Lead.find({
  $or: [
    { createdBy: username },
    { createdBy: { $exists: false } } // old data fix
  ]
});
}
if (user && user !== "All") {
   data = data.filter(l => l.createdBy === user);
}

  // YEARLY CASE (SPECIAL)
  if (type === "year") {

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const result = months.map(m => ({
  month: m,
  "In Progress": 0,
  Interested: 0,
  "Closed Won": 0,
  "Closed Lost": 0
}));

  data.forEach(l => {

        if (!l.lastFollowUp) return;

    const d = new Date(l.lastFollowUp + "T00:00:00");
    const monthIndex = d.getMonth();

    const key = (l.status || "").trim();

    if (result[monthIndex][key] !== undefined) {
      result[monthIndex][key]++;
    }

  });

  return res.json(result);
}


  // NORMAL (today/week/month) - EMPLOYEE WISE
let startDate = new Date();

if (type === "today") {
  startDate.setHours(0,0,0,0);
}

if (type === "week") {
  startDate.setDate(startDate.getDate() - 7);
}

if (type === "month") {
  startDate.setMonth(startDate.getMonth() - 1);
}

const filtered = data.filter(l => {
  if (!l.lastFollowUp) return false;
return new Date(l.lastFollowUp) >= startDate;
});

// GROUP BY EMPLOYEE
const users = {};

filtered.forEach(l => {
  const user = l.createdBy || "Unknown";

  if (!users[user]) {
    users[user] = {
  "In Progress": 0,
  Interested: 0,
  "Closed Won": 0,
  "Closed Lost": 0
};
  }

  const key = (l.status || "").trim();

  if (users[user][key] !== undefined) {
    users[user][key]++;
  }
});

res.json(users);
}); 

/* ================= SERVER ================= */


const PORT = process.env.PORT || 3000;
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://localhost:3000");
});