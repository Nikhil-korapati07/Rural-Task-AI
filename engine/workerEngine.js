// ============================================================
// Worker Engine — Registration, retrieval, and reliability updates
// ============================================================

const Worker = require("../models/Worker");

// ---- Create a new worker ----
async function createWorker({ name, skills, location }) {
  if (!name || !skills || !Array.isArray(skills) || skills.length === 0) {
    throw new Error("Worker must have a name and at least one skill.");
  }

  const existing = await Worker.findOne({ name: name.trim() });
  if (existing) {
    return existing;
  }

  // Normalize skills to lowercase for consistent matching
  const skillList = Array.isArray(skills) ? skills : [];
  const normalizedSkills = skillList.map((s) => s.trim().toLowerCase());

  // Initialize confidence at 50 for each skill (uncertain start)
  const skillConfidence = {};
  const skillUsageCount = {};
  normalizedSkills.forEach((skill) => {
    skillConfidence[skill] = 50;
    skillUsageCount[skill] = 0;
  });

  const worker = new Worker({
    name: name.trim(),
    skills: normalizedSkills,
    location: (location || "Unknown").trim(),
    skillConfidence,
    skillUsageCount,
    reliabilityScore: 50,
    status: "available",
    failureReasons: {},
    feedbackHistory: [],
    taskHistory: {
      total: 0,
      success: 0,
      failure: 0,
    }
  });

  await worker.save();
  console.log("Worker saved:", worker.name, `(${worker._id})`);
  return worker;
}

// ---- Get all workers ----
async function getAllWorkers() {
  return await Worker.find({});
}

// ---- Get a single worker by ID ----
async function getWorkerById(id) {
  const worker = await Worker.findById(id);
  if (!worker) throw new Error(`Worker not found: ${id}`);
  return worker;
}

// ---- Update reliability after task outcome ----
async function updateReliability(workerId, outcome) {
  const worker = await getWorkerById(workerId);

  worker.taskHistory.total += 1;

  if (outcome === "success") {
    worker.taskHistory.success += 1;
    worker.reliabilityScore = Math.min(100, worker.reliabilityScore + 10);
  } else if (outcome === "failure") {
    worker.taskHistory.failure += 1;
    worker.reliabilityScore = Math.max(0, worker.reliabilityScore - 15);
  }

  await worker.save();
  return worker;
}

// ---- Update skill confidence after verification ----
async function updateSkillConfidence(workerId, skill, passed, score = null) {
  const worker = await getWorkerById(workerId);
  const normalizedSkill = skill.trim().toLowerCase();

  if (!worker.skillConfidence.has(normalizedSkill)) {
    throw new Error(
      `Worker "${worker.name}" does not have skill "${normalizedSkill}".`
    );
  }

  if (score !== null) {
    // New Quiz-based update
    const current = worker.skillConfidence.get(normalizedSkill);
    if (score >= 60) {
      // Pass
      const boost = Math.max(5, Math.floor((100 - current) * (score / 200))); // Dynamic boost based on score
      worker.skillConfidence.set(normalizedSkill, Math.min(100, current + boost));
    } else {
      // Fail
      const penalty = Math.max(10, Math.floor(current * ( (100 - score) / 200 )));
      worker.skillConfidence.set(normalizedSkill, Math.max(0, current - penalty));
    }
  } else {
    // Legacy pass/fail (keep for compatibility if needed)
    if (passed) {
      const current = worker.skillConfidence.get(normalizedSkill);
      const boost = Math.max(5, Math.floor((100 - current) * 0.3));
      worker.skillConfidence.set(normalizedSkill, Math.min(100, current + boost));
    } else {
      const current = worker.skillConfidence.get(normalizedSkill);
      const penalty = Math.max(5, Math.floor(current * 0.2));
      worker.skillConfidence.set(normalizedSkill, Math.max(0, current - penalty));
    }
  }

  await worker.save();
  return worker;
}

module.exports = {
  createWorker,
  getAllWorkers,
  getWorkerById,
  updateReliability,
  updateSkillConfidence,
};
