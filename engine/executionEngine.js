// ============================================================
// Execution Engine — Start, Complete, Fail + Auto-Reassignment
// Handles the full job lifecycle and triggers recovery on failure
// ============================================================

const { getJobById, updateJobStatus } = require("./jobEngine");
const { updateReliability, getWorkerById } = require("./workerEngine");
const { excludeWorkerFromJob } = require("../store/dataStore");
const { assignBestWorker } = require("./matchingEngine");

// ---- Start a job ----
async function startJob(jobId) {
  const job = await getJobById(jobId);

  if (job.status !== "Assigned") {
    throw new Error(
      `Cannot start job "${job.title}": status is "${job.status}", expected "Assigned".`
    );
  }

  const worker = await getWorkerById(job.assignedWorker.id);
  worker.status = "busy";
  await worker.save();

  await updateJobStatus(jobId, "InProgress");

  return {
    job: await getJobById(jobId),
    message: `Job "${job.title}" started. Worker "${job.assignedWorker.name}" is now working.`,
  };
}

// ---- Complete a job successfully ----
async function completeJob(jobId, feedback) {
  const job = await getJobById(jobId);

  if (job.status !== "InProgress") {
    throw new Error(
      `Cannot complete job "${job.title}": status is "${job.status}", expected "InProgress".`
    );
  }

  const worker = await getWorkerById(job.assignedWorker.id);

  // 1. Update job status
  await updateJobStatus(jobId, "Completed");
  job.feedback = feedback;
  await job.save();

  // 2. Reward worker reliability (+10 baseline)
  await updateReliability(worker.id, "success");

  // 3. Apply feedback bonus (rating 1-5)
  if (feedback && feedback.rating) {
    worker.reliabilityScore = Math.min(100, worker.reliabilityScore + (feedback.rating * 2));
    worker.feedbackHistory.unshift({
      rating: feedback.rating,
      comment: feedback.comment,
      jobTitle: job.title,
      date: new Date().toLocaleDateString()
    });
    if (worker.feedbackHistory.length > 5) worker.feedbackHistory.pop();
  }

  // 4. Update skill usage
  job.requiredSkills.forEach(s => {
    const current = worker.skillUsageCount.get(s) || 0;
    worker.skillUsageCount.set(s, current + 1);
  });

  // 5. Free the worker
  worker.status = "available";
  await worker.save();

  return {
    job: await getJobById(jobId),
    workerUpdate: {
      id: worker.id,
      name: worker.name,
      newReliability: worker.reliabilityScore,
      status: worker.status
    },
    message: `Job completed! Worker "${worker.name}" reliability is now ${worker.reliabilityScore}%.`,
  };
}

// ---- Fail a job + Auto-Reassign ----
async function failJob(jobId, failureReason) {
  const job = await getJobById(jobId);

  if (job.status !== "InProgress") {
    throw new Error(
      `Cannot fail job "${job.title}": status is "${job.status}", expected "InProgress".`
    );
  }

  const worker = await getWorkerById(job.assignedWorker.id);
  const failedWorkerId = worker.id;
  const failedWorkerName = worker.name;

  // 1. Penalize worker reliability (-15)
  await updateReliability(failedWorkerId, "failure");

  // 2. Track failure reason
  const reasonType = failureReason || "Unknown";
  const currentFailures = worker.failureReasons.get(reasonType) || 0;
  worker.failureReasons.set(reasonType, currentFailures + 1);

  // 3. Mark job as Failed
  await updateJobStatus(jobId, "Failed");
  job.timeline.push(`Failure Reason: ${reasonType}`);
  await job.save();

  // 4. Free the failed worker
  worker.status = "available";
  await worker.save();

  // 5. Exclude failed worker from future candidates for this job
  excludeWorkerFromJob(jobId, failedWorkerId);

  // 6. Reset job to Pending for reassignment
  await updateJobStatus(jobId, "Pending");

  // 7. Attempt auto-reassignment
  let reassignment = null;
  let reassignmentError = null;

  try {
    reassignment = await assignBestWorker(jobId, { isReassignment: true });
  } catch (err) {
    reassignmentError = err.message;
  }

  const finalJob = await getJobById(jobId);

  return {
    failedWorker: {
      id: failedWorkerId,
      name: failedWorkerName,
      newReliability: worker.reliabilityScore,
      failureReasons: worker.failureReasons
    },
    reassignment: (reassignment && reassignment.assignment)
      ? {
        success: true,
        newWorker: reassignment.assignment.worker,
        newWorkerId: reassignment.assignment.workerId,
        confidenceScore: reassignment.assignment.confidenceScore,
        scoreBreakdown: reassignment.assignment.scoreBreakdown,
        reason: reassignment.assignment.reason,
        job: reassignment.job,
      }
      : {
        success: false,
        reason: "No suitable worker available for reassignment",
        job: finalJob,
      },
    message: (reassignment && reassignment.assignment)
      ? `Job failed by "${failedWorkerName}". Auto-reassigned to "${reassignment.assignment.worker}".`
      : `Job failed by "${failedWorkerName}". No suitable worker available for reassignment.`,
  };
}

module.exports = { startJob, completeJob, failJob };
