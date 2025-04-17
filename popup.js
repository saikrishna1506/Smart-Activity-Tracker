// ---------- General Utility Functions ----------
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
  container.innerHTML = (logs || []).map(log => `
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

// ---------- Chart Rendering ----------
let activityChartInstance = null;

function renderActivityChart() {
  chrome.storage.local.get(["categoryData"], (data) => {
    const categoryData = data.categoryData || {};

    const labels = Object.keys(categoryData);
    const values = labels.map(label => categoryData[label].totalWatchTime || 0);

    if (labels.length === 0) {
      // No real data, show dummy/fallback chart
      labels.push("No data yet");
      values.push(1);
    }

    const canvas = document.getElementById("activityChart");
    const ctx = canvas.getContext("2d");

    if (activityChartInstance) {
      activityChartInstance.destroy();
    }

    activityChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [{
          label: "Time Spent by Category (seconds)",
          data: values,
          backgroundColor: [
            "#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0",
            "#03a9f4", "#8bc34a", "#ffc107", "#f44336"
          ]
        }]
      }
    });
  });
}


// ---------- Event Binding ----------
document.addEventListener("DOMContentLoaded", () => {
  // Load local storage data
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

  // Save interval
  document.getElementById("saveIntervalBtn").addEventListener("click", () => {
    const interval = parseInt(document.getElementById("intervalInput").value, 10);
    if (isNaN(interval) || interval < 1) return showToast("⚠️ Invalid interval");
    chrome.storage.local.set({ nudgeInterval: interval });
    showToast("✅ Interval updated to " + interval + " min");
  });

  // Tab switching
  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const target = document.getElementById(tabId);
    target.classList.add('active');

    if (tabId === 'statsTab') {
      setTimeout(() => renderActivityChart(), 50);
    }
  }

  document.getElementById("nudgeTabBtn").addEventListener("click", () => switchTab("nudgeTab"));
  document.getElementById("statsTabBtn").addEventListener("click", () => switchTab("statsTab"));

  switchTab("nudgeTab"); // Default

  // Handle runtime messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "NUDGE") {
      updateNudgeBox(msg.nudge);
    } else if (msg.type === "AI_NUDGE_ERROR") {
      showToast(`⚠️ ${msg.message}`);
      updateNudgeBox("Nudge unavailable.");
    }
  });
});

//ONOFF
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-extension");
  const contentArea = document.getElementById("content-area");

  // Load toggle state on startup
  chrome.storage.local.get("extensionEnabled", (data) => {
    const enabled = data.extensionEnabled !== false; // default true
    toggle.checked = enabled;
    contentArea.style.display = enabled ? "block" : "none";
  });

  // Toggle state change
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ extensionEnabled: enabled }, () => {
      console.log(`[POPUP] Extension ${enabled ? "enabled" : "disabled"}`);
      contentArea.style.display = enabled ? "block" : "none";
    });
  });
});

