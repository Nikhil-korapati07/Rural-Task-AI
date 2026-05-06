// ============================================================
// Rural Task AI — Express Server
// Integrated with MongoDB for persistence
// ============================================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

// Models
const User = require("./models/User");

// Engine imports
const {
  createWorker,
  getAllWorkers,
  getWorkerById,
} = require("./engine/workerEngine");
const { createJob, getAllJobs, getJobById } = require("./engine/jobEngine");
const { verifySkill } = require("./engine/skillVerifier");
const { assignBestWorker } = require("./engine/matchingEngine");
const { startJob, completeJob, failJob } = require("./engine/executionEngine");
const { dataStore } = require("./store/dataStore");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- MongoDB Connection ----
mongoose.connect('mongodb://127.0.0.1:27017/rural-task-ai')
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("📡 Persistence Layer: ACTIVE");
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Models
const Job = require("./models/Job");
const Worker = require("./models/Worker");
const { getQuestions } = require("./engine/skillVerifier");

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- Error wrapper ----
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      console.error("API Error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  };
}

// ============================================================
// 0. AUTH ENDPOINTS (Simplified for Demo)
// ============================================================

app.post("/auth/signup", asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;
  const user = new User({ username, password, role });
  await user.save();
  res.status(201).json({ success: true, message: "User created" });
}));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) throw new Error("Invalid credentials");
  res.json({ success: true, user: { username: user.username, role: user.role } });
}));

// ============================================================
// 1. WORKER ENDPOINTS
// ============================================================

app.post("/workers", asyncHandler(async (req, res) => {
  const { name, skills, location } = req.body;
  const worker = await createWorker({ name, skills, location });
  res.status(201).json({
    success: true,
    message: `Worker "${worker.name}" registered.`,
    worker,
  });
}));

app.get("/workers", asyncHandler(async (req, res) => {
  const workers = await getAllWorkers();
  res.json({ success: true, count: workers.length, workers });
}));

app.get("/workers/:id", asyncHandler(async (req, res) => {
  const worker = await getWorkerById(req.params.id);
  res.json({ success: true, worker });
}));

// ============================================================
// 2. SKILL VERIFICATION ENDPOINT
// ============================================================

app.post("/verify-skill", asyncHandler(async (req, res) => {
  const { workerId, skill, passed, score } = req.body;
  const result = await verifySkill(workerId, skill, passed, score);
  res.json({ success: true, ...result });
}));

// ============================================================
// 3. JOB ENDPOINTS
// ============================================================

app.post("/jobs", asyncHandler(async (req, res) => {
  const { title, requiredSkills, location } = req.body;
  const job = await createJob({ title, requiredSkills, location });
  res.status(201).json({ success: true, message: `Job created.`, job });
}));

app.get("/jobs", asyncHandler(async (req, res) => {
  const jobs = await getAllJobs();
  res.json({ success: true, count: jobs.length, jobs });
}));

app.get("/jobs/:id", asyncHandler(async (req, res) => {
  const job = await getJobById(req.params.id);
  res.json({ success: true, job });
}));

// ============================================================
// 4. MATCHING ENGINE
// ============================================================

app.post("/assign/:jobId", asyncHandler(async (req, res) => {
  const result = await assignBestWorker(req.params.jobId);
  res.json({ success: true, ...result });
}));

// ============================================================
// 5. JOB EXECUTION ENDPOINTS
// ============================================================

app.post("/start/:jobId", asyncHandler(async (req, res) => {
  const result = await startJob(req.params.jobId);
  res.json({ success: true, ...result });
}));

app.post("/complete/:jobId", asyncHandler(async (req, res) => {
  const { feedback } = req.body;
  const result = await completeJob(req.params.jobId, feedback);
  res.json({ success: true, ...result });
}));

app.post("/fail/:jobId", asyncHandler(async (req, res) => {
  const { failureReason } = req.body;
  const result = await failJob(req.params.jobId, failureReason);
  res.json({ success: true, ...result });
}));

// ============================================================
// 6. SYSTEM ENDPOINTS
// ============================================================

app.get("/stats", asyncHandler(async (req, res) => {
  const workers = await getAllWorkers();
  const jobs = await getAllJobs();

  const stats = {
    totalWorkers: workers.length,
    totalJobs: jobs.length,
    jobsByStatus: {
      Pending: jobs.filter((j) => j.status === "Pending").length,
      Assigned: jobs.filter((j) => j.status === "Assigned").length,
      InProgress: jobs.filter((j) => j.status === "InProgress").length,
      Completed: jobs.filter((j) => j.status === "Completed").length,
      Failed: jobs.filter((j) => j.status === "Failed").length,
    },
    topWorkers: workers
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, 3)
      .map(w => ({ name: w.name, score: w.reliabilityScore })),
    failureInsights: workers.reduce((acc, w) => {
      w.failureReasons.forEach((count, type) => {
        acc[type] = (acc[type] || 0) + count;
      });
      return acc;
    }, {}),
    avgReliability: workers.length > 0
      ? Math.round((workers.reduce((s, w) => s + w.reliabilityScore, 0) / workers.length))
      : 0,
    assignmentLog: dataStore.assignmentLog,
  };

  res.json({ success: true, stats });
}));

// GET /questions/:skill — Get hybrid AI/static quiz questions for a skill
app.get("/questions/:skill", asyncHandler(async (req, res) => {
  const forceAI = req.query.force === 'true';
  const questions = await getQuestions(req.params.skill, forceAI);
  res.json({ success: true, questions: questions || [] });
}));

// POST /reset-db — Clear jobs only (Smart Feature)
app.post("/reset-db", asyncHandler(async (req, res) => {
  await Job.deleteMany({});
  console.log("🛠️ Resetting demo: All jobs cleared.");
  res.json({ success: true, message: "Jobs cleared successfully. Workers preserved." });
}));

// POST /clear-workers — Clear all workers
app.post("/clear-workers", asyncHandler(async (req, res) => {
  await Worker.deleteMany({});
  res.json({ success: true, message: "Workers cleared successfully." });
}));

// POST /reset-all — Full demo reset
app.post("/reset-all", asyncHandler(async (req, res) => {
  try {
    await Worker.deleteMany({});
    await Job.deleteMany({});
    await User.deleteMany({});
    console.log("🛠️ Fresh Start: All data cleared.");
    res.json({ success: true, message: "All data cleared" });
  } catch (err) {
    res.status(500).json({ error: "Reset failed" });
  }
}));

app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`  Rural Task AI — Persistent Engine`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});
