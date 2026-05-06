// ============================================================
// Skill Verifier — Micro skill verification with confidence update
// ============================================================

const { updateSkillConfidence } = require("./workerEngine");
const Question = require("../models/Question");

const domainQuestions = {
  Farming: [
    { q: "Which of these is a common method to improve soil fertility?", options: ["Overgrazing", "Crop rotation", "Deforestation", "Monoculture"], a: 1 },
    { q: "What is the primary purpose of a greenhouse?", options: ["Storing grain", "Raising livestock", "Controlled environment for plants", "Housing workers"], a: 2 },
    { q: "Which tool is best for tilling small garden beds?", options: ["Combine harvester", "Tractor", "Hand tiller", "Plough"], a: 2 }
  ],
  Welding: [
    { q: "What gas is commonly used in MIG welding?", options: ["Oxygen", "Argon", "Carbon Monoxide", "Nitrogen"], a: 1 },
    { q: "What does TIG stand for in welding?", options: ["Tough Iron Gas", "Tungsten Inert Gas", "Thermal Induction Gear", "Total Iron Grinding"], a: 1 },
    { q: "Which safety gear is most critical for eye protection in welding?", options: ["Sunglasses", "Clear goggles", "Auto-darkening helmet", "Reading glasses"], a: 2 }
  ],
  Carpentry: [
    { q: "Which saw is best for making curved cuts in wood?", options: ["Hand saw", "Circular saw", "Jigsaw", "Table saw"], a: 2 },
    { q: "What is the standard height of a kitchen countertop?", options: ["24 inches", "30 inches", "36 inches", "42 inches"], a: 2 },
    { q: "Which of these is used to check if a surface is perfectly vertical?", options: ["Tape measure", "Plumb bob", "Spirit level", "Square"], a: 1 }
  ],
  Electrician: [
    { q: "What is the unit of electrical resistance?", options: ["Volt", "Ampere", "Ohm", "Watt"], a: 2 },
    { q: "Which wire is typically used for grounding in a circuit?", options: ["Red", "Black", "Green or Bare", "White"], a: 2 },
    { q: "What device is used to measure current?", options: ["Voltmeter", "Ammeter", "Ohmmeter", "Wattmeter"], a: 1 }
  ],
  Plumbing: [
    { q: "What is the main purpose of a P-trap under a sink?", options: ["Catching lost jewelry", "Preventing sewer gases from entering", "Increasing water pressure", "Filtering waste"], a: 1 },
    { q: "Which material is most commonly used for modern residential water supply lines?", options: ["Lead", "PEX", "Cast iron", "Clay"], a: 1 },
    { q: "What tool is used to clear a clogged drain?", options: ["Wrench", "Plunger", "Screwdriver", "Hammer"], a: 1 }
  ],
  Construction: [
    { q: "What is the primary ingredient in concrete?", options: ["Wood", "Cement", "Steel", "Glass"], a: 1 },
    { q: "What does 'PSI' stand for when referring to concrete strength?", options: ["Pressure System Index", "Pounds per Square Inch", "Partial Surface Integration", "Primary Steel Induction"], a: 1 },
    { q: "Which of these is used to reinforce concrete structures?", options: ["Rope", "Rebar", "Plastic", "Glue"], a: 1 }
  ],
  Dairy: [
    { q: "What is the process of heating milk to kill harmful bacteria called?", options: ["Fermentation", "Pasteurization", "Homogenization", "Distillation"], a: 1 },
    { q: "Which cow breed is most famous for high milk production?", options: ["Angus", "Holstein", "Hereford", "Brahman"], a: 1 },
    { q: "What is the average gestation period for a cow?", options: ["3 months", "6 months", "9 months", "12 months"], a: 2 }
  ],
  default: [
    { q: "Is safety the top priority at a workplace?", options: ["No", "Sometimes", "Yes", "Only if supervised"], a: 2 },
    { q: "What should you do if you find damaged equipment?", options: ["Use it anyway", "Fix it yourself without training", "Report it immediately", "Hide it"], a: 2 },
    { q: "Why is punctuality important?", options: ["It's not", "Shows respect and reliability", "Only for bosses", "To leave early"], a: 1 }
  ]
};

const domainPrompts = {
  farming: "Generate practical MCQ questions for farming focusing on irrigation, crop rotation, soil nutrients, and agriculture safety.",
  welding: "Generate practical MCQ questions for welding focusing on MIG/TIG techniques, metallurgy, gas safety, and eye protection.",
  carpentry: "Generate practical MCQ questions for carpentry focusing on wood joints, measuring tape usage, circular saws, chisels, and workshop safety.",
  teaching: "Generate practical MCQ questions for teaching focusing on pedagogy, lesson planning, classroom engagement, and formative assessment.",
  electrician: "Generate practical MCQ questions for electricians focusing on circuit grounding, voltage testing, wiring diagrams, and high-voltage safety.",
  plumbing: "Generate practical MCQ questions for plumbing focusing on P-traps, pipe materials, leak sealing, and water pressure dynamics.",
  "dairy farming": "Generate practical MCQ questions for dairy farming focusing on pasteurization, cow gestation, milking machinery, and hygiene.",
  construction: "Generate practical MCQ questions for construction focusing on load-bearing walls, concrete mixing (PSI), rebar placement, and site safety."
};

const domainQuestionsPool = {
  farming: [
    { q: "[AI Generated] What is the primary benefit of crop rotation in sustainable agriculture?", options: ["It uses more water", "It naturally replenishes soil nutrients and breaks pest cycles", "It makes harvesting harder", "It requires more chemical pesticides"], a: 1 },
    { q: "[AI Generated] Which irrigation method minimizes water loss to evaporation in arid environments?", options: ["Flood irrigation", "Drip irrigation", "Overhead sprinklers", "Manual watering"], a: 1 },
    { q: "[AI Generated] How can a farmer safely and effectively manage early-stage crop diseases?", options: ["Ignore them", "Use resistant varieties and integrated pest management (IPM)", "Burn the entire field", "Double the standard fertilizer amount"], a: 1 }
  ],
  carpentry: [
    { q: "[AI Generated] Which tool is best suited for making curved, intricate cuts in a wooden board?", options: ["Table saw", "Jigsaw", "Planer", "Chisel"], a: 1 },
    { q: "[AI Generated] What is the strongest and most traditional wood joint for connecting two pieces at a 90-degree angle?", options: ["Butt joint", "Pocket hole joint", "Mortise and tenon", "Nail joint"], a: 2 },
    { q: "[AI Generated] When operating a circular saw, what is the most critical safety practice?", options: ["Work as fast as possible", "Use a push stick and wear safety glasses", "Remove the blade guard for visibility", "Wear loose, comfortable clothing"], a: 1 }
  ],
  teaching: [
    { q: "[AI Generated] What is the primary purpose of formative assessment in modern pedagogy?", options: ["To grade the student at the end of the year", "To monitor learning and provide ongoing feedback", "To strictly discipline poor behavior", "To extend the lesson duration"], a: 1 },
    { q: "[AI Generated] Which strategy is most consistently effective for maximizing classroom engagement?", options: ["Monotone lecturing", "Active learning and collaborative group discussions", "Reading silently from a textbook for 2 hours", "Ignoring student questions"], a: 1 },
    { q: "[AI Generated] What is a critical component of effective daily lesson planning?", options: ["Setting clear, measurable learning objectives", "Making up activities on the spot", "Using the exact same lesson plan for a decade", "Skipping the introduction entirely"], a: 0 }
  ]
};

// Simulated AI Call
async function generateAIQuestions(skill) {
  const normalizedSkill = skill.toLowerCase().trim();
  const domainPrompt = domainPrompts[normalizedSkill] || `Generate practical MCQ questions for ${normalizedSkill}`;
  
  // In a real system, we would send `domainPrompt` to OpenAI here.
  // We simulate the targeted response based on the domain.
  
  try {
    return await new Promise((resolve) => {
      setTimeout(() => {
        const generatedQuestions = domainQuestionsPool[normalizedSkill] || [
          { q: `[AI Generated] What is the most critical safety practice when performing ${normalizedSkill} tasks?`, options: ["Ignore safety guidelines", "Wear the correct personal protective equipment (PPE)", "Rush through the task", "Only use safety gear when supervised"], a: 1 },
          { q: `[AI Generated] Which of the following is a fundamental concept in ${normalizedSkill}?`, options: ["Using proper techniques and specialized tools", "Guessing the correct method", "Skipping the planning phase", "Using bare hands for everything"], a: 0 },
          { q: `[AI Generated] How should you address an unexpected problem during a ${normalizedSkill} job?`, options: ["Hide the mistake", "Blame the equipment", "Assess the situation, report if necessary, and apply standard corrective procedures", "Leave the site immediately"], a: 2 }
        ];
        resolve(generatedQuestions);
      }, 1500); // 1.5s delay to simulate external API
    });
  } catch (err) {
    return null;
  }
}

async function getQuestions(skill, forceAI = false) {
  const normalizedSkill = skill.toLowerCase().trim();

  if (!forceAI) {
    // 1. Check DB cache using lowercased normalized string
    const cached = await Question.findOne({ skill: normalizedSkill });
    if (cached) {
      return cached.questions;
    }
  } else {
    // Force new cache
    await Question.deleteMany({ skill: normalizedSkill });
  }

  // 2. Try AI generation with timeout safety (4 seconds max)
  const aiPromise = generateAIQuestions(normalizedSkill);
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), 4000));
  
  try {
    const aiQuestions = await Promise.race([aiPromise, timeoutPromise]);
    if (aiQuestions) {
      await Question.create({
        skill: normalizedSkill,
        questions: aiQuestions,
        source: "ai",
        createdAt: new Date()
      });
      return aiQuestions;
    }
  } catch (err) {
    console.error("AI Generation failed or timed out:", err.message);
  }

  // 3. Fallback to static questions (ensuring exact match with old logic)
  const capitalized = normalizedSkill.charAt(0).toUpperCase() + normalizedSkill.slice(1);
  return domainQuestions[capitalized] || domainQuestions.default;
}

// ---- Verify a skill for a worker ----
// Now supports score-based verification (quiz cutoff)
async function verifySkill(workerId, skill, passed, score = null) {
  const normalizedSkill = skill.trim().toLowerCase();

  // Update the worker's confidence for that skill
  const updatedWorker = await updateSkillConfidence(workerId, normalizedSkill, passed, score);

  const newConfidence = updatedWorker.skillConfidence.get(normalizedSkill);

  return {
    workerId,
    workerName: updatedWorker.name,
    skill: normalizedSkill,
    passed: score !== null ? score >= 60 : passed,
    score,
    newConfidence,
    message: (score !== null ? score >= 60 : passed)
      ? `Skill "${normalizedSkill}" verified successfully. Confidence: ${newConfidence}%`
      : `Skill "${normalizedSkill}" verification failed. Confidence dropped to ${newConfidence}%`,
  };
}

module.exports = { verifySkill, domainQuestions, getQuestions };
