function updateNudgeBox(content) {
  document.getElementById("nudge").innerText = content || "No nudge yet.";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
}

function displayActivityLog(logs) {
  const container = document.getElementById("activityLog");
  container.innerHTML = logs.map(log => `
    <div class="log-entry">
      <div class="title">${log.title}</div>
      <div class="url">${new URL(log.url).hostname}</div>
      <div class="time">${new Date(log.timestamp).toLocaleTimeString()}</div>
    </div>
  `).join("");
}

function displayYouTubeSummary(categoryData) {
  const container = document.getElementById("youtubeSummary");
  const entries = Object.entries(categoryData || {});
  if (entries.length === 0) {
    container.innerText = "No data yet.";
    return;
  }

  container.innerHTML = entries.map(([category, data]) => `
    <div class="log-entry">
      <div class="title">Category: ${category}</div>
      <div>Videos Watched: ${data.count}</div>
      <div>Total Watch Time: ${data.totalWatchTime} sec</div>
    </div>
  `).join("");
}

// Load stored nudge and logs
chrome.storage.local.get(["lastNudge", "activityLog", "categoryData", "nudgeInterval"], (data) => {
  updateNudgeBox(data.lastNudge);
  displayActivityLog(data.activityLog || []);
  displayYouTubeSummary(data.categoryData || {});
  document.getElementById("intervalInput").value = data.nudgeInterval || 1;
});

// Refresh nudge
document.getElementById("refreshBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "REFRESH_NUDGE" });
  updateNudgeBox("Refreshing...");
});

// Save nudge interval
document.getElementById("saveIntervalBtn").addEventListener("click", () => {
  const interval = parseInt(document.getElementById("intervalInput").value, 10);
  if (isNaN(interval) || interval < 1) return showToast("⚠️ Invalid interval");
  chrome.storage.local.set({ nudgeInterval: interval });
  showToast("✅ Interval updated to " + interval + " min");
});

// Receive new nudges
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NUDGE") {
    updateNudgeBox(msg.nudge);
  } else if (msg.type === "AI_NUDGE_ERROR") {
    showToast(`⚠️ ${msg.message}`);
    updateNudgeBox("Nudge unavailable.");
  }
});
