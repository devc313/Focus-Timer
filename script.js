const STORAGE_KEY = "focus-timer-state-v2";
const FOCUS_PRESETS = [25, 50, 90];

const MODE_CONFIG = {
  focus: {
    label: "Focus",
    getMinutes: (selectedFocusMinutes) => selectedFocusMinutes,
  },
  shortBreak: {
    label: "Short Break",
    getMinutes: () => 5,
  },
  longBreak: {
    label: "Long Break",
    getMinutes: () => 15,
  },
};

const timerDisplay = document.getElementById("timerDisplay");
const timerState = document.getElementById("timerState");
const timerHint = document.getElementById("timerHint");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const refreshSceneButton = document.getElementById("refreshSceneButton");
const timerCard = document.querySelector(".timer-card");
const backgroundImage = document.getElementById("bgImage");
const appShell = document.querySelector(".app-shell");
const soundButtons = document.querySelectorAll(".sound-toggle");
const presetButtons = document.querySelectorAll(".preset-button");
const modeButtons = document.querySelectorAll(".mode-button");
const progressFill = document.getElementById("progressFill");
const sessionMeta = document.getElementById("sessionMeta");
const taskInput = document.getElementById("taskInput");
const taskSummary = document.getElementById("taskSummary");
const saveTaskButton = document.getElementById("saveTaskButton");
const clearTaskButton = document.getElementById("clearTaskButton");
const statSessions = document.getElementById("statSessions");
const statMinutes = document.getElementById("statMinutes");
const statMode = document.getElementById("statMode");

let timerDurationSeconds = 25 * 60;
let remainingSeconds = timerDurationSeconds;
let intervalId = null;
let audioContext = null;
let selectedFocusMinutes = 25;
let currentMode = "focus";
let currentTask = "";
let stats = {
  completedFocusSessions: 0,
  totalFocusMinutes: 0,
};

const noiseBufferCache = new Map();
const activeAmbientSounds = new Map();
const pendingAmbientButtons = new WeakSet();

function readStoredState() {
  const defaultState = {
    selectedFocusMinutes: 25,
    currentMode: "focus",
    currentTask: "",
    stats: {
      completedFocusSessions: 0,
      totalFocusMinutes: 0,
    },
  };

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return defaultState;
    }

    const parsedState = JSON.parse(rawState);
    const safePreset = FOCUS_PRESETS.includes(parsedState.selectedFocusMinutes) ? parsedState.selectedFocusMinutes : 25;
    const safeMode = Object.prototype.hasOwnProperty.call(MODE_CONFIG, parsedState.currentMode)
      ? parsedState.currentMode
      : "focus";
    const safeTask = typeof parsedState.currentTask === "string" ? parsedState.currentTask.slice(0, 80) : "";

    return {
      selectedFocusMinutes: safePreset,
      currentMode: safeMode,
      currentTask: safeTask,
      stats: {
        completedFocusSessions: Number.isFinite(parsedState.stats?.completedFocusSessions)
          ? Math.max(0, parsedState.stats.completedFocusSessions)
          : 0,
        totalFocusMinutes: Number.isFinite(parsedState.stats?.totalFocusMinutes)
          ? Math.max(0, parsedState.stats.totalFocusMinutes)
          : 0,
      },
    };
  } catch (error) {
    return defaultState;
  }
}

function persistState() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedFocusMinutes,
        currentMode,
        currentTask,
        stats,
      }),
    );
  } catch (error) {
    // Ignore storage failures to keep the app usable in restricted contexts.
  }
}

function getCurrentMinutes() {
  return MODE_CONFIG[currentMode].getMinutes(selectedFocusMinutes);
}

function getModeLabel(mode) {
  return MODE_CONFIG[mode].label;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getReadyHint() {
  if (currentMode === "focus") {
    return `Your ${selectedFocusMinutes} minute focus session is ready.`;
  }

  if (currentMode === "shortBreak") {
    return "Time for a 5 minute reset.";
  }

  return "Time for a 15 minute recharge.";
}

function updateTimerDisplay() {
  const currentTime = formatTime(remainingSeconds);
  timerDisplay.textContent = currentTime;
  document.title = `${currentTime} - Focus Timer`;
}

function updateProgress() {
  const progress = timerDurationSeconds === 0 ? 0 : remainingSeconds / timerDurationSeconds;
  progressFill.style.width = `${Math.max(progress, 0) * 100}%`;
}

function setHint(message) {
  timerHint.textContent = message;
}

function updateTaskButtons() {
  const trimmedTask = taskInput.value.trim();
  const isUnchanged = trimmedTask === currentTask;
  saveTaskButton.disabled = trimmedTask.length === 0 || isUnchanged;
  clearTaskButton.disabled = trimmedTask.length === 0 && currentTask.length === 0;
}

function updateTaskSummary() {
  taskSummary.textContent = currentTask || "Add a task to anchor this session.";
}

function updateSessionMeta() {
  const minutes = getCurrentMinutes();
  const baseLabel = currentMode === "focus"
    ? `${minutes}-minute focus sprint`
    : `${minutes}-minute ${getModeLabel(currentMode).toLowerCase()}`;

  sessionMeta.textContent = currentTask ? `${baseLabel} - ${currentTask}` : baseLabel;
}

function updateStatsUi() {
  statSessions.textContent = String(stats.completedFocusSessions);
  statMinutes.textContent = String(stats.totalFocusMinutes);
  statMode.textContent = getModeLabel(currentMode);
}

function clearCompletedState() {
  timerCard.classList.remove("is-complete");
  timerState.textContent = "Ready";
  timerDisplay.classList.remove("is-ticking");
}

function syncPresetButtons() {
  presetButtons.forEach((button) => {
    const isActive = Number(button.dataset.minutes) === selectedFocusMinutes;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncModeButtons() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === currentMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function stopTimer() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function completeTimer() {
  stopTimer();
  remainingSeconds = 0;
  updateTimerDisplay();
  updateProgress();
  timerCard.classList.add("is-complete");
  timerState.textContent = "Complete";
  timerDisplay.classList.remove("is-ticking");

  if (currentMode === "focus") {
    stats.completedFocusSessions += 1;
    stats.totalFocusMinutes += selectedFocusMinutes;

    if (stats.completedFocusSessions % 4 === 0) {
      setHint("Focus complete. A long break would be a good reset.");
    } else {
      setHint("Focus complete. A short break is ready when you are.");
    }
  } else {
    setHint("Break complete. Step back into focus when you are ready.");
  }

  updateStatsUi();
  persistState();
  document.title = "Session Complete - Focus Timer";
}

function tick() {
  if (remainingSeconds <= 0) {
    completeTimer();
    return;
  }

  remainingSeconds -= 1;
  updateTimerDisplay();
  updateProgress();
  timerDisplay.classList.add("is-ticking");

  if (remainingSeconds <= 0) {
    completeTimer();
  }
}

function resetTimer(options = {}) {
  const { announce = true } = options;

  stopTimer();
  timerDurationSeconds = getCurrentMinutes() * 60;
  remainingSeconds = timerDurationSeconds;
  clearCompletedState();
  updateTimerDisplay();
  updateProgress();
  updateSessionMeta();
  updateStatsUi();

  if (announce) {
    setHint(getReadyHint());
  }
}

function startTimer() {
  if (intervalId) {
    return;
  }

  if (remainingSeconds <= 0) {
    resetTimer({ announce: false });
  }

  clearCompletedState();
  timerState.textContent = "Running";
  timerDisplay.classList.add("is-ticking");
  setHint(currentMode === "focus" ? "Focus session started. Stay with the rhythm." : "Break started. Reset your attention gently.");
  intervalId = window.setInterval(tick, 1000);
}

function pauseTimer() {
  if (!intervalId) {
    return;
  }

  stopTimer();
  timerState.textContent = "Paused";
  timerDisplay.classList.remove("is-ticking");
  setHint("Timer paused. Jump back in when you are ready.");
}

function setMode(mode, options = {}) {
  const { announce = true } = options;
  if (!Object.prototype.hasOwnProperty.call(MODE_CONFIG, mode)) {
    return;
  }

  currentMode = mode;
  syncModeButtons();
  updateStatsUi();
  resetTimer({ announce });
  persistState();
}

function setFocusPreset(minutes) {
  if (!FOCUS_PRESETS.includes(minutes)) {
    return;
  }

  selectedFocusMinutes = minutes;
  syncPresetButtons();
  currentMode = "focus";
  syncModeButtons();
  resetTimer({ announce: true });
  persistState();
}

function saveTask() {
  currentTask = taskInput.value.trim().slice(0, 80);
  taskInput.value = currentTask;
  updateTaskSummary();
  updateSessionMeta();
  updateTaskButtons();
  persistState();
  setHint(currentTask ? "Task saved for this session." : getReadyHint());
}

function clearTask() {
  currentTask = "";
  taskInput.value = "";
  updateTaskSummary();
  updateSessionMeta();
  updateTaskButtons();
  persistState();
  setHint("Task cleared. Pick the next target when you are ready.");
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }

  audioContext = new AudioContextClass();
  return audioContext;
}

function getNoiseBuffer(context, color) {
  const cacheKey = `${color}-${context.sampleRate}`;
  if (noiseBufferCache.has(cacheKey)) {
    return noiseBufferCache.get(cacheKey);
  }

  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channelData = buffer.getChannelData(0);

  if (color === "brown") {
    let lastValue = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      lastValue = (lastValue + 0.02 * white) / 1.02;
      channelData[index] = lastValue * 3.5;
    }
  } else {
    for (let index = 0; index < length; index += 1) {
      channelData[index] = Math.random() * 2 - 1;
    }
  }

  noiseBufferCache.set(cacheKey, buffer);
  return buffer;
}

function createNoiseSource(context, color) {
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context, color);
  source.loop = true;
  return source;
}

function fadeGain(audioParam, value, duration = 0.45) {
  const now = audioContext.currentTime;
  audioParam.cancelScheduledValues(now);
  audioParam.setValueAtTime(audioParam.value, now);
  audioParam.linearRampToValueAtTime(value, now + duration);
}

function createRainSound(context) {
  const output = context.createGain();
  output.gain.value = 0;
  output.connect(context.destination);

  const rainNoise = createNoiseSource(context, "white");
  const rainHighPass = context.createBiquadFilter();
  rainHighPass.type = "highpass";
  rainHighPass.frequency.value = 500;

  const rainLowPass = context.createBiquadFilter();
  rainLowPass.type = "lowpass";
  rainLowPass.frequency.value = 6800;

  const rainTexture = context.createGain();
  rainTexture.gain.value = 0.22;

  const rainMotion = context.createOscillator();
  rainMotion.type = "sine";
  rainMotion.frequency.value = 0.07;

  const rainMotionDepth = context.createGain();
  rainMotionDepth.gain.value = 650;

  rainNoise.connect(rainHighPass);
  rainHighPass.connect(rainLowPass);
  rainLowPass.connect(rainTexture);
  rainTexture.connect(output);
  rainMotion.connect(rainMotionDepth);
  rainMotionDepth.connect(rainLowPass.frequency);

  rainNoise.start();
  rainMotion.start();

  let dropletTimerId = null;
  let isStopped = false;

  function scheduleDroplet() {
    if (isStopped) {
      return;
    }

    dropletTimerId = window.setTimeout(() => {
      if (isStopped) {
        return;
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const dropletGain = context.createGain();
      const dropletFilter = context.createBiquadFilter();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(900 + Math.random() * 1400, now);
      oscillator.frequency.exponentialRampToValueAtTime(450 + Math.random() * 180, now + 0.11);

      dropletFilter.type = "bandpass";
      dropletFilter.frequency.value = 1200 + Math.random() * 1800;
      dropletFilter.Q.value = 2.4;

      dropletGain.gain.setValueAtTime(0.0001, now);
      dropletGain.gain.exponentialRampToValueAtTime(0.02, now + 0.015);
      dropletGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      oscillator.connect(dropletFilter);
      dropletFilter.connect(dropletGain);
      dropletGain.connect(output);
      oscillator.start(now);
      oscillator.stop(now + 0.18);

      window.setTimeout(() => {
        oscillator.disconnect();
        dropletFilter.disconnect();
        dropletGain.disconnect();
      }, 220);

      scheduleDroplet();
    }, 120 + Math.random() * 260);
  }

  scheduleDroplet();

  return {
    start() {
      fadeGain(output.gain, 0.32, 0.7);
    },
    stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      if (dropletTimerId) {
        window.clearTimeout(dropletTimerId);
      }
      fadeGain(output.gain, 0.0001, 0.35);

      window.setTimeout(() => {
        rainNoise.stop();
        rainMotion.stop();
        rainNoise.disconnect();
        rainHighPass.disconnect();
        rainLowPass.disconnect();
        rainTexture.disconnect();
        rainMotion.disconnect();
        rainMotionDepth.disconnect();
        output.disconnect();
      }, 420);
    },
  };
}

function createForestSound(context) {
  const output = context.createGain();
  output.gain.value = 0;
  output.connect(context.destination);

  const forestNoise = createNoiseSource(context, "brown");
  const forestHighPass = context.createBiquadFilter();
  forestHighPass.type = "highpass";
  forestHighPass.frequency.value = 180;

  const forestLowPass = context.createBiquadFilter();
  forestLowPass.type = "lowpass";
  forestLowPass.frequency.value = 1450;

  const forestBed = context.createGain();
  forestBed.gain.value = 0.16;

  const windLfo = context.createOscillator();
  windLfo.type = "sine";
  windLfo.frequency.value = 0.045;

  const windDepth = context.createGain();
  windDepth.gain.value = 300;

  forestNoise.connect(forestHighPass);
  forestHighPass.connect(forestLowPass);
  forestLowPass.connect(forestBed);
  forestBed.connect(output);
  windLfo.connect(windDepth);
  windDepth.connect(forestLowPass.frequency);

  forestNoise.start();
  windLfo.start();

  let birdTimerId = null;
  let isStopped = false;

  function playBirdCall(startTime) {
    const oscillator = context.createOscillator();
    const chirpGain = context.createGain();

    oscillator.type = Math.random() > 0.5 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(1200 + Math.random() * 800, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(2200 + Math.random() * 900, startTime + 0.07);
    oscillator.frequency.exponentialRampToValueAtTime(900 + Math.random() * 300, startTime + 0.16);

    chirpGain.gain.setValueAtTime(0.0001, startTime);
    chirpGain.gain.exponentialRampToValueAtTime(0.016, startTime + 0.03);
    chirpGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

    oscillator.connect(chirpGain);
    chirpGain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.22);

    window.setTimeout(() => {
      oscillator.disconnect();
      chirpGain.disconnect();
    }, 260);
  }

  function scheduleBirds() {
    if (isStopped) {
      return;
    }

    birdTimerId = window.setTimeout(() => {
      if (isStopped) {
        return;
      }

      const startTime = context.currentTime;
      playBirdCall(startTime);
      if (Math.random() > 0.45) {
        playBirdCall(startTime + 0.12 + Math.random() * 0.18);
      }
      scheduleBirds();
    }, 1800 + Math.random() * 4200);
  }

  scheduleBirds();

  return {
    start() {
      fadeGain(output.gain, 0.26, 0.9);
    },
    stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      if (birdTimerId) {
        window.clearTimeout(birdTimerId);
      }
      fadeGain(output.gain, 0.0001, 0.45);

      window.setTimeout(() => {
        forestNoise.stop();
        windLfo.stop();
        forestNoise.disconnect();
        forestHighPass.disconnect();
        forestLowPass.disconnect();
        forestBed.disconnect();
        windLfo.disconnect();
        windDepth.disconnect();
        output.disconnect();
      }, 520);
    },
  };
}

const ambientFactories = {
  rain: createRainSound,
  forest: createForestSound,
};

function setSoundButtonState(button, active) {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
  const stateLabel = button.querySelector(".sound-state");
  stateLabel.textContent = active ? "On" : "Off";
}

async function toggleSound(button) {
  if (pendingAmbientButtons.has(button)) {
    return;
  }

  const soundName = button.dataset.sound;
  const soundLabel = button.querySelector(".sound-name").textContent;
  const soundFactory = ambientFactories[soundName];

  if (!soundFactory) {
    setHint("That ambient channel is not available right now.");
    return;
  }

  const shouldActivate = button.getAttribute("aria-pressed") !== "true";

  if (!shouldActivate) {
    const activeSound = activeAmbientSounds.get(soundName);
    if (activeSound) {
      activeSound.stop();
      activeAmbientSounds.delete(soundName);
    }
    setSoundButtonState(button, false);
    setHint(`${soundLabel} ambience turned off.`);
    return;
  }

  try {
    pendingAmbientButtons.add(button);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    const context = getAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    const existingSound = activeAmbientSounds.get(soundName);
    if (existingSound) {
      existingSound.stop();
    }

    const soundInstance = soundFactory(context);
    soundInstance.start();
    activeAmbientSounds.set(soundName, soundInstance);
    setSoundButtonState(button, true);
    setHint(`${soundLabel} ambience turned on.`);
  } catch (error) {
    setHint("Unable to start ambience. Check browser audio permissions.");
    setSoundButtonState(button, false);
  } finally {
    pendingAmbientButtons.delete(button);
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
  }
}

function loadRandomBackground(showHint = true) {
  const randomSeed = Math.floor(Math.random() * 10000);
  const imageUrl = `https://source.unsplash.com/featured/1800x1200/?nature,landscape&sig=${randomSeed}`;

  refreshSceneButton.disabled = true;
  refreshSceneButton.setAttribute("aria-busy", "true");
  appShell.classList.add("is-refreshing");
  backgroundImage.classList.remove("is-visible");

  const preloadedImage = new Image();
  preloadedImage.onload = () => {
    backgroundImage.src = imageUrl;
    backgroundImage.classList.add("is-visible");
    window.setTimeout(() => {
      appShell.classList.remove("is-refreshing");
      refreshSceneButton.disabled = false;
      refreshSceneButton.setAttribute("aria-busy", "false");
    }, 180);

    if (showHint) {
      setHint("Fresh scene loaded. Settle in and focus.");
    }
  };

  preloadedImage.onerror = () => {
    backgroundImage.classList.add("is-visible");
    appShell.classList.remove("is-refreshing");
    refreshSceneButton.disabled = false;
    refreshSceneButton.setAttribute("aria-busy", "false");
    setHint("Background image failed to load. Staying with the dark fallback.");
  };

  preloadedImage.src = imageUrl;
}

function handleKeyboardShortcuts(event) {
  if (event.repeat) {
    return;
  }

  const activeElement = document.activeElement;
  const isTypingContext = activeElement
    && (activeElement.tagName === "INPUT"
      || activeElement.tagName === "TEXTAREA"
      || activeElement.isContentEditable);

  if (isTypingContext) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (intervalId) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  if (event.key.toLowerCase() === "r") {
    resetTimer({ announce: true });
  }
}

function initializeApp() {
  const storedState = readStoredState();

  selectedFocusMinutes = storedState.selectedFocusMinutes;
  currentMode = storedState.currentMode;
  currentTask = storedState.currentTask;
  stats = storedState.stats;
  timerDurationSeconds = MODE_CONFIG[currentMode].getMinutes(selectedFocusMinutes) * 60;
  remainingSeconds = timerDurationSeconds;

  taskInput.value = currentTask;
  syncPresetButtons();
  syncModeButtons();
  updateTaskSummary();
  updateTaskButtons();
  updateSessionMeta();
  updateStatsUi();
  updateTimerDisplay();
  updateProgress();
  setHint(getReadyHint());
  loadRandomBackground(false);
}

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", () => {
  resetTimer({ announce: true });
});
refreshSceneButton.addEventListener("click", () => {
  loadRandomBackground(true);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setFocusPreset(Number(button.dataset.minutes));
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode, { announce: true });
  });
});

taskInput.addEventListener("input", updateTaskButtons);
taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveTask();
  }
});

saveTaskButton.addEventListener("click", saveTask);
clearTaskButton.addEventListener("click", clearTask);

soundButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toggleSound(button);
  });
});

document.addEventListener("keydown", handleKeyboardShortcuts);
window.addEventListener("beforeunload", () => {
  activeAmbientSounds.forEach((soundInstance) => {
    soundInstance.stop();
  });
});

initializeApp();
