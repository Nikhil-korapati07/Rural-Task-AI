// ============================================================
// Rural Task AI — In-Memory Data Store
// Centralized storage for workers, jobs, and assignment logs
// ============================================================

const dataStore = {
  // All registered workers keyed by id
  workers: new Map(),

  // All posted jobs keyed by id
  jobs: new Map(),

  // Assignment audit log — every assignment/reassignment recorded
  assignmentLog: [],

  // Track which workers have been excluded from a job (failed workers)
  jobExclusions: new Map(), // jobId -> Set of workerIds
};

// ---- Helper: get exclusions for a job ----
function getExcludedWorkers(jobId) {
  if (!dataStore.jobExclusions.has(jobId)) {
    dataStore.jobExclusions.set(jobId, new Set());
  }
  return dataStore.jobExclusions.get(jobId);
}

// ---- Helper: add exclusion ----
function excludeWorkerFromJob(jobId, workerId) {
  const exclusions = getExcludedWorkers(jobId);
  exclusions.add(workerId);
}

// ---- Helper: log an assignment event ----
function logAssignment(entry) {
  dataStore.assignmentLog.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  dataStore,
  getExcludedWorkers,
  excludeWorkerFromJob,
  logAssignment,
};
