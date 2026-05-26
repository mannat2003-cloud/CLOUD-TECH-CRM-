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