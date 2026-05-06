// ============================================================
// Job Engine — Job creation, retrieval, and status management
// ============================================================

const Job = require("../models/Job");

const VALID_STATUSES = [
  "Pending",
  "Assigned",
  "InProgress",
  "Completed",
  "Failed",
];

// ---- Create a new job ----
async function createJob({ title, requiredSkills, location }) {
  if (
    !title ||
    !requiredSkills ||
    !Array.isArray(requiredSkills) ||
    requiredSkills.length === 0
  ) {
    throw new Error("Job must have a title and at least one required skill.");
  }

  const job = new Job({
    title: title.trim(),
    requiredSkills: requiredSkills.map((s) => (typeof s === 'string' ? s : s.skill).trim().toLowerCase()),
    skillPriorities: requiredSkills.map((s) => ({
      skill: (typeof s === 'string' ? s : s.skill).trim().toLowerCase(),
      priority: typeof s === 'object' ? s.priority || 1 : 1
    })),
    location: (location || "Unknown").trim(),
    status: "Pending",
    assignedWorker: null,
    confidenceScore: null,
    scoreBreakdown: null,
    assignmentReason: null,
    reassignmentHistory: [],
    timeline: [`Job Created (${new Date().toLocaleTimeString()})`],
    feedback: null
  });

  await job.save();
  console.log("Job saved:", job.title, `(${job._id})`);
  return job;
}

// ---- Get all jobs ----
async function getAllJobs() {
  return await Job.find({}).sort({ createdAt: -1 });
}

// ---- Get a single job by ID ----
async function getJobById(id) {
  const job = await Job.findById(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  return job;
}

// ---- Update job status with validation ----
async function updateJobStatus(jobId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const job = await getJobById(jobId);

  // Status transition validation
  const allowedTransitions = {
    Pending: ["Assigned"],
    Assigned: ["InProgress", "Pending"],
    InProgress: ["Completed", "Failed"],
    Completed: [],
    Failed: ["Pending"],
  };

  if (!allowedTransitions[job.status].includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${job.status}" to "${newStatus}".`
    );
  }

  job.status = newStatus;
  job.timeline.push(`${newStatus} (${new Date().toLocaleTimeString()})`);
  await job.save();
  return job;
}

// ---- Assign a worker to a job ----
async function assignWorkerToJob(
  jobId,
  { workerId, workerName, confidenceScore, scoreBreakdown, reason }
) {
  const job = await getJobById(jobId);

  // If reassigning, save history
  if (job.assignedWorker && job.assignedWorker.id) {
    job.reassignmentHistory.push({
      previousWorker: { id: job.assignedWorker.id, name: job.assignedWorker.name },
      previousScore: job.confidenceScore,
      previousReason: job.assignmentReason,
      reassignedAt: new Date()
    });
  }

  job.assignedWorker = { id: workerId, name: workerName };
  job.confidenceScore = confidenceScore;
  job.scoreBreakdown = scoreBreakdown;
  job.assignmentReason = reason;
  job.status = "Assigned";
  job.timeline.push(`Assigned to ${workerName} (${new Date().toLocaleTimeString()})`);

  await job.save();
  return job;
}

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJobStatus,
  assignWorkerToJob,
};
