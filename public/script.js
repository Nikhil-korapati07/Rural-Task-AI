const API_BASE = '';

// Global state
let workers = [];
let jobs = [];
let currentJobActionId = null;
let isRefreshing = false;
let currentQuizSkill = null;
let currentQuizWorkerId = null;

// DOM Elements
const workerForm = document.getElementById('worker-form');
const jobForm = document.getElementById('job-form');
const workersList = document.getElementById('workers-list');
const jobsList = document.getElementById('jobs-list');
const verifyWorkerSelect = document.getElementById('workerSelect');
const verifySkillSelect = document.getElementById('skillSelect');
const toast = document.getElementById('toast');
const insightsGrid = document.getElementById('insights-grid');

// Modals
const feedbackModal = document.getElementById('feedback-modal');
const failureModal = document.getElementById('failure-modal');
const quizModal = document.getElementById('quiz-modal');

// --- Initialization ---
async function init() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('user-display').textContent = `👤 ${user.username} (${user.role})`;
    
    await loadWorkers();
    await fetchJobs();
    await fetchStats();
    setupEventListeners();
}

function showEmailNotification(to, subject, message) {
    const modal = document.createElement("div");
    modal.className = "email-modal";
    modal.innerHTML = `
        <div class="email-content">
            <h3>📧 Notification Sent (Simulated)</h3>
            <p><strong>To:</strong> ${to}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px;">${message}</p>
            <button onclick="this.parentElement.parentElement.remove()" class="primary">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function clearAllInputs() {
    document.querySelectorAll("input").forEach(input => input.value = "");
    document.querySelectorAll("select").forEach(select => select.selectedIndex = 0);
}

document.addEventListener("DOMContentLoaded", init);

// --- API Calls ---
async function loadWorkers() {
    const res = await fetch(`${API_BASE}/workers`);
    const data = await res.json();
    workers = data.workers;

    renderWorkers();

    if (verifyWorkerSelect) {
        const currentId = verifyWorkerSelect.value;
        verifyWorkerSelect.innerHTML = '<option value="">Select Worker</option>';
        workers.forEach(worker => {
            const option = document.createElement("option");
            option.value = worker._id;
            option.textContent = worker.name;
            if (worker._id === currentId) option.selected = true;
            verifyWorkerSelect.appendChild(option);
        });
        updateVerifySkills();
    }
}

async function fetchJobs() {
    const res = await fetch(`${API_BASE}/jobs`);
    const data = await res.json();
    jobs = data.jobs;
    renderJobs();
}

async function fetchStats() {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) renderInsights(data.stats);
}

async function apiPost(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

// --- Render Functions ---
function renderInsights(stats) {
    insightsGrid.innerHTML = `
        <div class="stat-card">
            <span style="color: var(--text-muted)">Avg Reliability</span>
            <span class="stat-value">${stats.avgReliability}%</span>
        </div>
        <div class="stat-card">
            <span style="color: var(--text-muted)">Top Worker</span>
            <span class="stat-value">${stats.topWorkers[0]?.name || 'N/A'}</span>
        </div>
        <div class="stat-card">
            <span style="color: var(--text-muted)">Common Failure</span>
            <span class="stat-value">${Object.entries(stats.failureInsights).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'}</span>
        </div>
        <div class="stat-card">
            <span style="color: var(--text-muted)">Jobs Completed</span>
            <span class="stat-value">${stats.jobsByStatus.Completed}</span>
        </div>
    `;
}

function renderWorkers() {
    workersList.innerHTML = ""; // Clear existing before render
    workersList.innerHTML = workers.map(w => {
        const confValues = Object.values(w.skillConfidence || {});
        const isVerified = confValues.some(c => c > 70) || (w.taskHistory && w.taskHistory.success > 2);

        let trustLabel = 'Moderate';
        let trustClass = 'trust-moderate';
        if (w.reliabilityScore >= 80) { trustLabel = 'Trusted'; trustClass = 'trust-trusted'; }
        else if (w.reliabilityScore < 50) { trustLabel = 'Risky'; trustClass = 'trust-risky'; }

        const statusClass = w.status === 'available' ? 'status-available' : 'status-busy';
        const lastFeedback = (w.feedbackHistory && w.feedbackHistory[0]) ? `"${w.feedbackHistory[0].comment}" (${w.feedbackHistory[0].rating}⭐)` : 'No feedback yet';

        const skillsHtml = w.skills.map(s => {
            const conf = w.skillConfidence[s] || 50;
            const use = w.skillUsageCount[s] || 0;
            return `<span class="skill-tag">${s}: ${Math.floor(conf)}% [${use}]</span>`;
        }).join('');

        return `
        <div class="card" id="worker-${w._id}">
            <div class="card-header">
                <div>
                    <strong>${w.name} ${isVerified ? '<span class="verified-badge">✔</span>' : ''}</strong>
                    <span class="${statusClass}">${w.status.toUpperCase()}</span>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${trustClass}">${trustLabel}</span>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Rel: ${w.reliabilityScore}%</div>
                </div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">📍 ${w.location}</div>
            <div class="worker-skills">${skillsHtml}</div>
            <div class="comparison-box">
                <span class="comparison-title">Last Feedback</span>
                <span style="font-style: italic;">${lastFeedback}</span>
            </div>
        </div>
    `}).join('');
}

function renderJobs() {
    jobsList.innerHTML = ""; // Clear existing before render
    jobsList.innerHTML = jobs.length === 0 ? '<p style="color: var(--text-muted)">No jobs posted yet.</p>' :
        jobs.map(j => {
            const statusClass = `badge-${j.status.toLowerCase()}`;
            let breakdownHtml = '';
            if (j.assignedWorker && j.scoreBreakdown) {
                breakdownHtml = `
                <div class="score-breakdown">
                    <div class="score-item">Skills <span>${j.scoreBreakdown.skillMatch}</span></div>
                    <div class="score-item">Conf <span>${j.scoreBreakdown.skillConfidence}</span></div>
                    <div class="score-item">Rel <span>${j.scoreBreakdown.reliability}</span></div>
                </div>`;
            }

            return `
        <div class="card" id="job-${j._id}">
            <div class="card-header">
                <strong>${j.title}</strong>
                <span class="badge ${statusClass}">${j.status}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">📍 ${j.location} | Needs: ${j.requiredSkills.join(', ')}</div>
            ${j.assignedWorker ? `<div class="reason-box"><strong>${j.assignedWorker.name}</strong><p>"${j.assignmentReason}"</p></div>${breakdownHtml}` : ''}
            <div class="actions">
                ${j.status === 'Pending' ? `<button onclick="assignJob('${j._id}')">Match</button>` : ''}
                ${j.status === 'Assigned' ? `<button onclick="startJob('${j._id}')">Start</button>` : ''}
                ${j.status === 'InProgress' ? `<button onclick="openFeedbackModal('${j._id}')">Complete</button><button onclick="openFailureModal('${j._id}')">Fail</button>` : ''}
            </div>
        </div>`}).join('');
}

// --- Quiz Logic ---
let activeQuizQuestions = [];

async function openSkillQuiz(force = false) {
    const workerId = verifyWorkerSelect.value;
    const rawSkill = verifySkillSelect.value;
    if (!workerId || !rawSkill) return alert('Select worker and skill');
    
    const skill = rawSkill.toLowerCase().trim();
    console.log("Fetching questions for:", skill);
    
    currentQuizWorkerId = workerId;
    currentQuizSkill = skill;
    
    // Show a small loading toast if forcing AI
    if (force) showToast("Generating AI questions...", false);

    try {
        const res = await fetch(`${API_BASE}/questions/${skill}?force=${force}`);
        const data = await res.json();
        console.log("Questions response:", data);
        
        if (data.success && data.questions && data.questions.length > 0) {
            activeQuizQuestions = data.questions;
        } else {
            // Fallback questions if not found or empty
            activeQuizQuestions = [
                { q: "Is safety important in this domain?", options: ["Yes", "No", "Always", "Maybe"], a: 2 },
                { q: "Should you maintain your tools?", options: ["Never", "Sometimes", "Daily", "Weekly"], a: 2 },
                { q: "What is the key to quality work?", options: ["Speed", "Attention to detail", "Cutting corners", "Loud music"], a: 1 }
            ];
        }

        document.getElementById('quiz-skill-title').textContent = `Testing Skill: ${skill}`;
        document.getElementById('quiz-questions').innerHTML = activeQuizQuestions.map((q, i) => `
            <div class="form-group" style="margin-bottom: 1rem;">
                <p style="font-size: 0.9rem; margin-bottom: 0.5rem; ${q.q.includes('[AI') ? 'color: #6366f1; font-weight: bold;' : ''}">${i+1}. ${q.q}</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${q.options.map((opt, optIndex) => `
                        <label style="font-size: 0.8rem; cursor: pointer;">
                            <input type="radio" name="q${i}" value="${optIndex}"> ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        quizModal.classList.add('show');
    } catch (err) {
        console.error("Error loading quiz:", err);
        showToast("Failed to load quiz", true);
    }
}

async function submitQuiz() {
    let correct = 0;
    
    activeQuizQuestions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`)?.value;
        if (parseInt(selected) === q.a) correct++;
    });
    
    const score = Math.round((correct / activeQuizQuestions.length) * 100);
    const passed = score >= 60;
    
    const res = await apiPost('/verify-skill', { 
        workerId: currentQuizWorkerId, 
        skill: currentQuizSkill, 
        passed, 
        score 
    });
    
    if (res.success) {
        showToast(res.message);
        quizModal.classList.remove('show');
        await loadWorkers();
    }
}

// --- Action Handlers ---
function setupEventListeners() {
    jobForm.onsubmit = async (e) => {
        e.preventDefault();
        const skillsRaw = document.getElementById('job-skills').value.split(',');
        const requiredSkills = skillsRaw.map(s => {
            const parts = s.split(':');
            return { skill: parts[0].trim(), priority: parseInt(parts[1] || 1) };
        });
        const res = await apiPost('/jobs', {
            title: document.getElementById('job-title').value,
            requiredSkills,
            location: document.getElementById('job-location').value
        });
        if (res.success) { clearAllInputs(); showToast(res.message); await fetchJobs(); await assignJob(res.job._id); }
    };

    document.getElementById('submit-feedback').onclick = async () => {
        const res = await apiPost(`/complete/${currentJobActionId}`, { 
            feedback: { 
                rating: parseInt(document.getElementById('feedback-rating').value), 
                comment: document.getElementById('feedback-comment').value 
            } 
        });
        if (res.success) { 
            feedbackModal.classList.remove('show'); 
            showEmailNotification(
                "worker@rural.ai",
                "Job Completed",
                "Great job! Your reliability score has increased and your work has been successfully recorded."
            );
            await fetchJobs(); await loadWorkers(); await fetchStats(); 
        }
    };

    document.getElementById('submit-failure').onclick = async () => {
        await runFailJob(currentJobActionId, document.getElementById('failure-reason').value);
        failureModal.classList.remove('show');
    };

    verifyWorkerSelect.addEventListener("change", updateVerifySkills);
    const startQuizBtn = document.getElementById("startQuizBtn");
    if (startQuizBtn) {
        startQuizBtn.addEventListener("click", startQuiz);
        // Remove the inline onclick if it exists to avoid double calls
        startQuizBtn.removeAttribute("onclick");
    }

    const submitQuizBtn = document.getElementById("submitQuizBtn");
    if (submitQuizBtn) {
        submitQuizBtn.onclick = submitQuiz;
    }
    const closeQuizBtn = document.getElementById("closeQuizBtn");
    if (closeQuizBtn) {
        closeQuizBtn.onclick = () => closeModal('quiz-modal');
    }
    const generateAiQuizBtn = document.getElementById("generateAiQuizBtn");
    if (generateAiQuizBtn) {
        generateAiQuizBtn.onclick = () => openSkillQuiz(true);
    }

    document.getElementById('refreshBtn').onclick = handleRefresh;
    document.getElementById('notifyBtn').onclick = () => {
        showEmailNotification(
            "worker@rural.ai",
            "Manual Notification",
            "This is a system-generated update for demo purposes."
        );
    };
    document.getElementById('resetDemoBtn').onclick = resetDemo;
    
    const freshStartBtn = document.getElementById("freshStartBtn");
    if (freshStartBtn) {
        freshStartBtn.addEventListener("click", async () => {
            if (!confirm("This will delete all data. Continue?")) return;
            try {
                const res = await fetch("/reset-all", { method: "POST" });
                if (res.ok) {
                    clearAllInputs();
                    workers = [];
                    jobs = [];
                    document.getElementById("workers-list").innerHTML = "";
                    document.getElementById("jobs-list").innerHTML = "";
                    showToast("System fully reset");
                    
                    await loadWorkers();
                    await fetchJobs();
                    await fetchStats();
                }
            } catch (err) {
                console.error(err);
                showToast("Reset failed", true);
            }
        });
    }
}

async function handleRefresh() {
    await loadWorkers(); await fetchJobs(); await fetchStats();
    showToast("Data refreshed successfully");
}

async function resetDemo() {
    if (!confirm("Are you sure you want to clear all jobs? Workers will be preserved.")) return;
    
    try {
        const res = await apiPost('/reset-db', {});
        if (res.success) {
            showToast(res.message);
            
            clearAllInputs();
            workers = [];
            jobs = [];
            document.getElementById("workers-list").innerHTML = "";
            document.getElementById("jobs-list").innerHTML = "";
            
            await loadWorkers();
            await fetchJobs();
            await fetchStats();
        }
    } catch (err) {
        console.error("Error resetting demo:", err);
        showToast("Failed to reset demo", true);
    }
}

async function addWorker() {
    const name = document.getElementById("workerName").value;
    const skillsInput = document.getElementById("workerSkills").value;
    const location = document.getElementById("workerLocation").value;

    if (!name || !skillsInput || !location) {
        alert("Please fill all fields");
        return;
    }

    const skills = skillsInput.split(",")
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0);

    try {
        const res = await apiPost('/workers', { name, skills, location });
        if (res.success) {
            clearAllInputs();
            showToast(res.message);
            await loadWorkers();
        }
    } catch (err) {
        console.error("Error adding worker:", err);
    }
}

async function assignJob(jobId) {
    const res = await apiPost(`/assign/${jobId}`, {});
    if (res.success) {
        showToast(res.message);
        await fetchJobs();
        const job = jobs.find(j => j._id === jobId);
        if (job && job.assignedWorker) {
            showEmailNotification(
                "worker@rural.ai",
                "New Job Assigned",
                `You have been assigned to: ${job.title}. Please start immediately.`
            );
        }
    }
}

async function startJob(jobId) {
    const res = await apiPost(`/start/${jobId}`, {});
    if (res.success) {
        showToast(res.message);
        await fetchJobs();
        await loadWorkers();
    }
}

async function runFailJob(jobId, reason) {
    const res = await apiPost(`/fail/${jobId}`, { failureReason: reason });
    showToast(res.message);
    showEmailNotification(
        "worker@rural.ai",
        "Job Reassigned",
        "A job has been reassigned based on system evaluation after a reported failure."
    );
    await fetchJobs(); await loadWorkers(); await fetchStats();
}

function updateVerifySkills() {
    const selectedWorkerId = verifyWorkerSelect.value;
    const worker = workers.find(w => w._id === selectedWorkerId || w.id === selectedWorkerId);

    verifySkillSelect.innerHTML = '<option value="">Select Skill</option>';
    if (!worker || !worker.skills) return;

    worker.skills.forEach(skill => {
        const option = document.createElement("option");
        option.value = skill;
        option.textContent = skill.charAt(0).toUpperCase() + skill.slice(1);
        verifySkillSelect.appendChild(option);
    });
}

function startQuiz() {
    const workerId = verifyWorkerSelect.value;
    const skill = verifySkillSelect.value;

    if (!workerId || !skill) {
        alert("Please select worker and skill");
        return;
    }

    openQuizModal(skill, workerId);
}

async function openQuizModal(skill, workerId) {
    currentQuizWorkerId = workerId;
    currentQuizSkill = skill;
    
    const normalizedSkill = skill.toLowerCase().trim();
    console.log("Fetching questions for:", normalizedSkill);
    
    try {
        const response = await fetch(`${API_BASE}/questions/${normalizedSkill}`);
        const data = await response.json();
        console.log("Questions response:", data);
        
        if (data.success && data.questions && data.questions.length > 0) {
            activeQuizQuestions = data.questions;
            renderQuizUI(activeQuizQuestions, workerId, skill);
        } else {
            alert("No questions available for this skill");
        }
    } catch (err) {
        console.error("Error loading quiz:", err);
        showToast("Failed to load quiz", true);
    }
}

function renderQuizUI(questions, workerId, skill) {
    document.getElementById('quiz-skill-title').textContent = `Testing Skill: ${skill}`;
    document.getElementById('quiz-questions').innerHTML = questions.map((q, i) => `
        <div class="form-group" style="margin-bottom: 1rem;">
            <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${i+1}. ${q.q}</p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${q.options.map((opt, optIndex) => `
                    <label style="font-size: 0.8rem; cursor: pointer;">
                        <input type="radio" name="q${i}" value="${optIndex}"> ${opt}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    quizModal.classList.add('show');
}

function openFeedbackModal(id) { currentJobActionId = id; feedbackModal.classList.add('show'); }
function openFailureModal(id) { currentJobActionId = id; failureModal.classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
