/* ==========================================================================
   PULSE // FIT — script.js
   Vanilla JS, no backend, no build step. Two localStorage keys:
     pulsefit_profile  -> { name, age, gender, height, weight, bmi, category, goal, diet }
     pulsefit_workouts -> [{ id, type, duration, calories, date }]
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Constants & reference data
     --------------------------------------------------------------------- */
  const STORAGE_PROFILE = "pulsefit_profile";
  const STORAGE_WORKOUTS = "pulsefit_workouts";
  const STORAGE_HYDRATION = "pulsefit_hydration"; // { date: 'YYYY-MM-DD', ml: number }

  // Approx calories burned per minute by exercise type (moderate intensity).
  // Used to auto-calculate the logger's calories field; always manually overridable.
  const CAL_PER_MIN = {
    running: 10,
    yoga: 4,
    home: 8,
  };

  const EXERCISE_LABELS = {
    running: "Running / Cardio",
    yoga: "Yoga / Mobility",
    home: "Home Workout",
  };

  const EXERCISE_ICONS = { running: "🏃", yoga: "🧘", home: "🏋️" };

  const WEEKLY_CALORIE_TARGET = 3500; // simple flat weekly target used for the bar chart

  // Workout routines keyed by goal category.
  const WORKOUT_ROUTINES = {
    gain: {
      morning: [
        "5 min dynamic warm-up (arm circles, leg swings, bodyweight squats)",
        "Compound lifts: Squat 4×8, Bench/Push-up 4×8, Bent-over Row 4×8",
        "Accessory: Lunges 3×12, Shoulder Press 3×10",
      ],
      evening: [
        "20–25 min brisk walk or light cycling for recovery blood flow",
        "10 min mobility stretch focused on hips and shoulders",
      ],
    },
    maintain: {
      morning: [
        "5 min warm-up + mobility flow",
        "Full-body strength circuit: Squat, Push-up, Row, Plank — 3 rounds × 12 reps / 40s hold",
        "Optional: 15 min moderate-pace run",
      ],
      evening: [
        "20 min yoga flow (Sun Salutations + balance poses) for recomposition and recovery",
        "5 min breathing / cooldown",
      ],
    },
    loss: {
      morning: [
        "5 min warm-up jog in place",
        "25–30 min steady-state cardio: running, brisk walking or cycling",
        "10 min core finisher: Plank 3×40s, Bicycle Crunch 3×20",
      ],
      evening: [
        "20 min HIIT-style bodyweight circuit: Jumping Jacks, Squats, Mountain Climbers, Burpees — 40s on / 20s off × 4 rounds",
        "10 min cooldown stretch",
      ],
    },
  };

  // Meal plans keyed by goal category then diet preference.
  const MEAL_PLANS = {
    gain: {
      vegetarian: {
        calories: 2600, protein: "110–120g",
        breakfast: "Oats with peanut butter, banana and milk + 2 boiled eggs substitute: paneer bhurji",
        lunch: "Rice, dal, paneer curry, mixed vegetable sabzi, curd",
        snack: "Trail mix (nuts + dried fruit) with a protein shake",
        dinner: "Whole wheat roti, rajma or chole, sautéed greens, a bowl of curd",
      },
      "non-vegetarian": {
        calories: 2700, protein: "130–140g",
        breakfast: "4-egg omelette, whole wheat toast, avocado, milk",
        lunch: "Grilled chicken breast, brown rice, dal, salad",
        snack: "Greek yogurt with honey and granola, boiled eggs",
        dinner: "Fish or chicken curry, roti, sautéed vegetables",
      },
    },
    maintain: {
      vegetarian: {
        calories: 2000, protein: "75–85g",
        breakfast: "Vegetable poha or upma with a glass of milk",
        lunch: "Roti, dal, seasonal vegetable sabzi, salad",
        snack: "Fruit bowl with roasted chana",
        dinner: "Khichdi or roti-sabzi, curd, light soup",
      },
      "non-vegetarian": {
        calories: 2100, protein: "90–100g",
        breakfast: "Egg bhurji with toast and fruit",
        lunch: "Grilled chicken or fish, roti, salad",
        snack: "Boiled eggs or a protein shake with a fruit",
        dinner: "Light chicken curry, brown rice, sautéed vegetables",
      },
    },
    loss: {
      vegetarian: {
        calories: 1500, protein: "70–80g",
        breakfast: "Moong dal chilla or vegetable oats, black coffee/green tea",
        lunch: "Roti (1–2), dal, large portion salad, sautéed vegetables",
        snack: "Buttermilk or a small fruit + roasted makhana",
        dinner: "Vegetable soup, grilled paneer, salad",
      },
      "non-vegetarian": {
        calories: 1600, protein: "95–105g",
        breakfast: "Egg whites (3–4) with vegetables, black coffee",
        lunch: "Grilled chicken breast, large salad, small portion brown rice",
        snack: "Boiled eggs or tuna with cucumber",
        dinner: "Grilled fish or chicken, steamed vegetables, clear soup",
      },
    },
  };

  const GOAL_LABELS = {
    gain: "Healthy Weight Gain & Muscle Building",
    maintain: "Maintain Fitness & Body Recomposition",
    loss: "Active Fat Loss & Cardiovascular Health",
  };

  /* ---------------------------------------------------------------------
     DOM references
     --------------------------------------------------------------------- */
  const onboardingSection = document.getElementById("onboarding");
  const dashboardSection = document.getElementById("dashboard");
  const profileForm = document.getElementById("profileForm");
  const resetBtn = document.getElementById("resetBtn");
  const navProfileName = document.getElementById("navProfileName");

  const bmiValueEl = document.getElementById("bmiValue");
  const bmiCategoryEl = document.getElementById("bmiCategory");
  const summaryGreeting = document.getElementById("summaryGreeting");
  const summaryGoal = document.getElementById("summaryGoal");
  const summaryDiet = document.getElementById("summaryDiet");

  const statWorkouts = document.getElementById("statWorkouts");
  const statCalories = document.getElementById("statCalories");
  const statMinutes = document.getElementById("statMinutes");
  const statHydration = document.getElementById("statHydration");
  const hydrateBtn = document.getElementById("hydrateBtn");

  const workoutPlanEl = document.getElementById("workoutPlan");
  const mealPlanEl = document.getElementById("mealPlan");
  const planDietTag = document.getElementById("planDietTag");

  const exerciseSelector = document.getElementById("exerciseSelector");
  const selectedTypeInput = document.getElementById("selectedType");
  const loggerHint = document.getElementById("loggerHint");
  const workoutForm = document.getElementById("workoutForm");
  const workoutDuration = document.getElementById("workoutDuration");
  const workoutCalories = document.getElementById("workoutCalories");
  const workoutDate = document.getElementById("workoutDate");

  const activityLogEl = document.getElementById("activityLog");

  let caloriesChart = null;
  let categoryChart = null;

  /* ---------------------------------------------------------------------
     Storage helpers
     --------------------------------------------------------------------- */
  const loadProfile = () => JSON.parse(localStorage.getItem(STORAGE_PROFILE) || "null");
  const saveProfile = (p) => localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));

  const loadWorkouts = () => JSON.parse(localStorage.getItem(STORAGE_WORKOUTS) || "[]");
  const saveWorkouts = (w) => localStorage.setItem(STORAGE_WORKOUTS, JSON.stringify(w));

  const loadHydration = () => JSON.parse(localStorage.getItem(STORAGE_HYDRATION) || "null");
  const saveHydration = (h) => localStorage.setItem(STORAGE_HYDRATION, JSON.stringify(h));

  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* ---------------------------------------------------------------------
     Seed sample data on first load so charts/log are visible immediately
     --------------------------------------------------------------------- */
  function seedSampleWorkoutsIfEmpty() {
    if (loadWorkouts().length > 0) return;
    const today = new Date();
    const daysAgo = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const sample = [
      { id: cryptoId(), type: "running", duration: 28, calories: 280, date: daysAgo(1) },
      { id: cryptoId(), type: "yoga", duration: 35, calories: 140, date: daysAgo(2) },
      { id: cryptoId(), type: "home", duration: 25, calories: 200, date: daysAgo(4) },
      { id: cryptoId(), type: "running", duration: 20, calories: 200, date: daysAgo(6) },
    ];
    saveWorkouts(sample);
  }

  function cryptoId() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  }

  /* ---------------------------------------------------------------------
     BMI engine
     --------------------------------------------------------------------- */
  function calcBmi(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }

  function classifyBmi(bmi) {
    if (bmi < 18.5) return { category: "Underweight", cssTag: "tag-underweight", goal: "gain" };
    if (bmi < 25) return { category: "Normal", cssTag: "tag-normal", goal: "maintain" };
    if (bmi < 30) return { category: "Overweight", cssTag: "tag-overweight", goal: "loss" };
    return { category: "Obese", cssTag: "tag-obese", goal: "loss" };
  }

  /* ---------------------------------------------------------------------
     Onboarding submit -> build profile -> render dashboard
     --------------------------------------------------------------------- */
  profileForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("userName").value.trim();
    const age = Number(document.getElementById("userAge").value);
    const gender = document.getElementById("userGender").value;
    const height = Number(document.getElementById("userHeight").value);
    const weight = Number(document.getElementById("userWeight").value);
    const diet = profileForm.querySelector('input[name="diet"]:checked').value;

    const bmi = calcBmi(weight, height);
    const { category, cssTag, goal } = classifyBmi(bmi);

    const profile = {
      name, age, gender, height, weight,
      bmi: Number(bmi.toFixed(1)),
      category, cssTag, goal, diet,
    };

    saveProfile(profile);
    seedSampleWorkoutsIfEmpty();
    renderDashboard();
  });

  /* ---------------------------------------------------------------------
     Reset profile
     --------------------------------------------------------------------- */
  resetBtn.addEventListener("click", () => {
    if (!confirm("This clears your profile and starts onboarding again. Your logged workouts stay saved. Continue?")) return;
    localStorage.removeItem(STORAGE_PROFILE);
    dashboardSection.classList.add("hidden");
    onboardingSection.classList.remove("hidden");
    resetBtn.classList.add("hidden");
    navProfileName.classList.add("hidden");
    profileForm.reset();
  });

  /* ---------------------------------------------------------------------
     Render: profile summary + plan cards
     --------------------------------------------------------------------- */
  function renderProfileSummary(profile) {
    bmiValueEl.textContent = profile.bmi.toFixed(1);
    bmiCategoryEl.textContent = profile.category;
    bmiCategoryEl.className = "bmi-figure-tag " + profile.cssTag;

    summaryGreeting.textContent = `Welcome back, ${profile.name}`;
    summaryGoal.textContent = GOAL_LABELS[profile.goal];
    summaryDiet.textContent = profile.diet === "vegetarian" ? "Vegetarian" : "Non-Vegetarian";

    navProfileName.textContent = `${profile.name} · BMI ${profile.bmi.toFixed(1)}`;
    navProfileName.classList.remove("hidden");
    resetBtn.classList.remove("hidden");
  }

  function renderPlan(profile) {
    const routine = WORKOUT_ROUTINES[profile.goal];
    workoutPlanEl.innerHTML = `
      <h4>Morning</h4>
      <ul>${routine.morning.map((i) => `<li>${i}</li>`).join("")}</ul>
      <h4>Evening</h4>
      <ul>${routine.evening.map((i) => `<li>${i}</li>`).join("")}</ul>
    `;

    const meal = MEAL_PLANS[profile.goal][profile.diet];
    planDietTag.textContent = profile.diet === "vegetarian" ? "VEG" : "NON-VEG";
    mealPlanEl.innerHTML = `
      <h4>Breakfast</h4><p>${meal.breakfast}</p>
      <h4>Lunch</h4><p>${meal.lunch}</p>
      <h4>Evening Snack</h4><p>${meal.snack}</p>
      <h4>Dinner</h4><p>${meal.dinner}</p>
      <div class="plan-stats-row">
        <div class="plan-stat"><span>Daily Target</span><span>${meal.calories} kcal</span></div>
        <div class="plan-stat"><span>Protein</span><span>${meal.protein}</span></div>
      </div>
    `;
  }

  /* ---------------------------------------------------------------------
     Render: stat counters
     --------------------------------------------------------------------- */
  function renderStats() {
    const workouts = loadWorkouts();
    const totalCalories = workouts.reduce((sum, w) => sum + w.calories, 0);
    const totalMinutes = workouts.reduce((sum, w) => sum + w.duration, 0);

    statWorkouts.textContent = workouts.length;
    statCalories.textContent = totalCalories.toLocaleString();
    statMinutes.textContent = totalMinutes.toLocaleString();

    let hydration = loadHydration();
    if (!hydration || hydration.date !== todayISO()) {
      hydration = { date: todayISO(), ml: 0 };
      saveHydration(hydration);
    }
    statHydration.innerHTML = `${hydration.ml}<small>ml</small>`;
  }

  hydrateBtn.addEventListener("click", () => {
    let hydration = loadHydration();
    if (!hydration || hydration.date !== todayISO()) hydration = { date: todayISO(), ml: 0 };
    hydration.ml += 250;
    saveHydration(hydration);
    renderStats();
  });

  /* ---------------------------------------------------------------------
     Exercise selector
     --------------------------------------------------------------------- */
  exerciseSelector.addEventListener("click", (e) => {
    const card = e.target.closest(".exercise-card");
    if (!card) return;
    exerciseSelector.querySelectorAll(".exercise-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    const type = card.dataset.type;
    selectedTypeInput.value = type;
    loggerHint.textContent = `Logging: ${EXERCISE_LABELS[type]}. Calories auto-estimate from duration — edit freely.`;
    autoEstimateCalories();
  });

  workoutDuration.addEventListener("input", autoEstimateCalories);

  function autoEstimateCalories() {
    const type = selectedTypeInput.value;
    const mins = Number(workoutDuration.value);
    if (!type || !mins) return;
    workoutCalories.value = Math.round(mins * CAL_PER_MIN[type]);
  }

  /* ---------------------------------------------------------------------
     Workout logger submit
     --------------------------------------------------------------------- */
  workoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = selectedTypeInput.value;
    if (!type) {
      loggerHint.textContent = "Select an exercise type above before logging.";
      loggerHint.style.color = "var(--coral)";
      return;
    }

    const duration = Number(workoutDuration.value);
    const calories = Number(workoutCalories.value) || Math.round(duration * CAL_PER_MIN[type]);
    const date = workoutDate.value || todayISO();

    const workouts = loadWorkouts();
    workouts.unshift({ id: cryptoId(), type, duration, calories, date });
    saveWorkouts(workouts);

    renderStats();
    renderActivityLog();
    renderCharts();

    workoutForm.reset();
    exerciseSelector.querySelectorAll(".exercise-card").forEach((c) => c.classList.remove("selected"));
    selectedTypeInput.value = "";
    loggerHint.style.color = "";
    loggerHint.textContent = "Pick an exercise type above to start logging.";
    workoutDate.value = todayISO();
  });

  /* ---------------------------------------------------------------------
     Recent activities list
     --------------------------------------------------------------------- */
  function renderActivityLog() {
    const workouts = loadWorkouts();
    if (workouts.length === 0) {
      activityLogEl.innerHTML = `<li class="activity-empty">No workouts logged yet — add your first session above.</li>`;
      return;
    }
    activityLogEl.innerHTML = workouts
      .slice(0, 12)
      .map((w) => `
        <li>
          <span class="activity-icon">${EXERCISE_ICONS[w.type]}</span>
          <span class="activity-main">
            <strong>${EXERCISE_LABELS[w.type]}</strong>
            <span>${formatDate(w.date)}</span>
          </span>
          <span class="activity-mins">${w.duration} min</span>
          <span class="activity-cals">${w.calories} kcal</span>
        </li>
      `)
      .join("");
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /* ---------------------------------------------------------------------
     Charts (Chart.js) — rebuilt on every workout log for live updates
     --------------------------------------------------------------------- */
  function renderCharts() {
    const workouts = loadWorkouts();

    // ---- Weekly calories bar chart: last 7 calendar days vs flat target ----
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const caloriesByDay = days.map((day) =>
      workouts.filter((w) => w.date === day).reduce((sum, w) => sum + w.calories, 0)
    );
    const dayLabels = days.map((day) =>
      new Date(day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })
    );
    const targetPerDay = Math.round(WEEKLY_CALORIE_TARGET / 7);

    const caloriesCtx = document.getElementById("caloriesChart");
    if (caloriesChart) caloriesChart.destroy();
    caloriesChart = new Chart(caloriesCtx, {
      type: "bar",
      data: {
        labels: dayLabels,
        datasets: [
          {
            label: "Burned",
            data: caloriesByDay,
            backgroundColor: "#00ff87",
            borderRadius: 4,
            maxBarThickness: 28,
          },
          {
            label: "Target",
            data: days.map(() => targetPerDay),
            backgroundColor: "rgba(34, 211, 238, 0.25)",
            borderColor: "#22d3ee",
            borderWidth: 1.5,
            borderRadius: 4,
            maxBarThickness: 28,
          },
        ],
      },
      options: chartBaseOptions({ stacked: false }),
    });

    // ---- Exercise category doughnut ----
    const totals = { running: 0, yoga: 0, home: 0 };
    workouts.forEach((w) => { totals[w.type] = (totals[w.type] || 0) + w.duration; });

    const categoryCtx = document.getElementById("categoryChart");
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(categoryCtx, {
      type: "doughnut",
      data: {
        labels: ["Running", "Yoga", "Home Workout"],
        datasets: [
          {
            data: [totals.running, totals.yoga, totals.home],
            backgroundColor: ["#00ff87", "#22d3ee", "#ffb454"],
            borderColor: "#0d1517",
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#86a19c", font: { family: "Inter", size: 12 }, padding: 14 } },
        },
      },
    });
  }

  function chartBaseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: "#86a19c" }, grid: { color: "#1f2e31" } },
        y: { ticks: { color: "#86a19c" }, grid: { color: "#1f2e31" }, beginAtZero: true },
      },
      plugins: {
        legend: { labels: { color: "#86a19c", font: { family: "Inter", size: 12 } } },
      },
    };
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function renderDashboard() {
    const profile = loadProfile();
    if (!profile) return;

    onboardingSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");

    renderProfileSummary(profile);
    renderPlan(profile);
    renderStats();
    renderActivityLog();
    renderCharts();
  }

  function init() {
    workoutDate.value = todayISO();
    const profile = loadProfile();
    if (profile) {
      seedSampleWorkoutsIfEmpty();
      renderDashboard();
    }
  }

  init();
})();
