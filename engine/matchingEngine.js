// ============================================================
// Matching Engine — The brain of the system
// Scores every eligible worker and picks the best match
// ============================================================

const { getAllWorkers } = require("./workerEngine");
const { getJobById, assignWorkerToJob } = require("./jobEngine");
const { getExcludedWorkers, logAssignment } = require("../store/dataStore");

// ---- Skill Confidence Decay ----
async function applyDecay() {
  const workers = await getAllWorkers();
  for (const w of workers) {
    w.skills.forEach(skill => {
      const current = w.skillConfidence.get(skill) || 50;
      w.skillConfidence.set(skill, Math.max(20, current - 0.5));
    });
    await w.save();
  }
}

// ---- Score a single worker against a job ----
function scoreWorker(worker, job) {
  const { requiredSkills, skillPriorities, location: jobLocation } = job;

  // 1. Availability Check
  if (worker.status !== "available") return null;

  // 2. Skill Match with Priority Weighting
  let weightedSkillScore = 0;
  let totalPriority = 0;
  
  skillPriorities.forEach(sp => {
    totalPriority += sp.priority;
    if (worker.skills.includes(sp.skill)) {
      weightedSkillScore += sp.priority * 100;
    }
  });
  const skillMatch = totalPriority > 0 ? weightedSkillScore / totalPriority : 0;

  // 3. Skill Confidence (weighted by priority)
  let weightedConfScore = 0;
  let relevantCount = 0;
  skillPriorities.forEach(sp => {
    const conf = worker.skillConfidence.get(sp.skill);
    if (conf !== undefined) {
      weightedConfScore += conf * sp.priority;
      relevantCount += sp.priority;
    }
  });
  const avgConfidence = relevantCount > 0 ? weightedConfScore / relevantCount : 0;

  // 4. Reliability
  const reliability = worker.reliabilityScore;

  // 5. Location Bonus (+10 for exact match)
  const locationBonus = worker.location.toLowerCase() === jobLocation.toLowerCase() ? 10 : 0;

  // 6. Skill Usage Bonus (+1 for every 5 uses, cap at 5)
  let totalUses = 0;
  requiredSkills.forEach(s => {
    totalUses += (worker.skillUsageCount.get(s) || 0);
  });
  const skillUsageBonus = Math.min(5, Math.floor(totalUses / 5));

  // Weighted composite score
  const baseScore = skillMatch * 0.4 + avgConfidence * 0.3 + reliability * 0.3;
  const totalScore = baseScore + locationBonus + skillUsageBonus;

  return {
    workerId: worker.id,
    workerName: worker.name,
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown: {
      skillMatch: Math.round(skillMatch * 100) / 100,
      skillConfidence: Math.round(avgConfidence * 100) / 100,
      reliability: Math.round(reliability * 100) / 100,
      locationBonus,
      skillUsageBonus
    },
    location: worker.location
  };
}

// ---- Build a human-readable reason string ----
function buildReason(workerName, breakdown, isReassignment = false) {
  const parts = [];
  if (breakdown.skillMatch >= 80) parts.push("high skill match");
  else if (breakdown.skillMatch >= 50) parts.push("moderate skill match");
  else parts.push("partial skill match");

  if (breakdown.skillConfidence >= 70) parts.push("strong skill confidence");
  else if (breakdown.skillConfidence >= 40) parts.push("moderate skill confidence");
  else parts.push("low skill confidence");

  if (breakdown.reliability >= 70) parts.push("strong past performance");
  else if (breakdown.reliability >= 40) parts.push("moderate past performance");
  else parts.push("limited track record");

  const prefix = isReassignment
    ? `Reassigned to ${workerName} due to previous worker failure.`
    : `Assigned to ${workerName}.`;

  return `${prefix} Reason: ${parts.join(" + ")}.`;
}

// ---- Main: find and assign the best worker for a job ----
async function assignBestWorker(jobId, { isReassignment = false } = {}) {
  await applyDecay();
  const job = await getJobById(jobId);

  if (job.status !== "Pending" && !isReassignment) {
    throw new Error(`Job "${job.title}" is not in Pending status.`);
  }

  const allWorkers = await getAllWorkers();
  if (allWorkers.length === 0) {
    throw new Error("No workers registered in the system.");
  }

  const excluded = getExcludedWorkers(jobId);

  const candidates = allWorkers
    .map((w) => scoreWorker(w, job))
    .filter((s) => s !== null && !excluded.has(s.workerId.toString()) && s.breakdown.skillMatch > 0) 
    .sort((a, b) => b.totalScore - a.totalScore);

  if (candidates.length === 0) {
    if (isReassignment) {
      return { success: false, message: "No suitable worker available for reassignment", job };
    }
    throw new Error(`No eligible workers found for "${job.title}".`);
  }

  const best = candidates[0];
  const secondBest = candidates.length > 1 ? candidates[1] : null;

  let comparison = "";
  if (secondBest) {
    const diffRel = best.breakdown.reliability - secondBest.breakdown.reliability;
    const diffConf = best.breakdown.skillConfidence - secondBest.breakdown.skillConfidence;
    if (diffRel > 10) comparison = ` Selected over ${secondBest.workerName} due to higher reliability.`;
    else if (diffConf > 10) comparison = ` Selected over ${secondBest.workerName} due to stronger confidence.`;
  }

  let reason = buildReason(best.workerName, best.breakdown, isReassignment);
  if (best.breakdown.locationBonus > 0) reason += " (Nearby Worker)";
  reason += comparison;

  const updatedJob = await assignWorkerToJob(jobId, {
    workerId: best.workerId,
    workerName: best.workerName,
    confidenceScore: best.totalScore,
    scoreBreakdown: best.breakdown,
    reason,
  });

  logAssignment({
    jobId,
    jobTitle: job.title,
    workerId: best.workerId,
    workerName: best.workerName,
    score: best.totalScore,
    breakdown: best.breakdown,
    reason,
    isReassignment,
  });

  return {
    job: updatedJob,
    assignment: {
      worker: best.workerName,
      workerId: best.workerId,
      confidenceScore: best.totalScore,
      scoreBreakdown: best.breakdown,
      reason,
    },
    allCandidates: candidates,
  };
}

module.exports = { assignBestWorker, scoreWorker };
