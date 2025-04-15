console.log("[BG] Background loaded");

// ========== CONFIG ==========
const NUDGE_INTERVAL_MINUTES = 1;
const MAX_HISTORY = 10;
const AI_API_KEY = "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";
const MODEL = "nvidia/llama-3.1-nemotron-nano-8b-v1:free";
const YOUTUBE_API_KEY = "AIzaSyDUzuIanvjZCfSB-CzwOwT1ZX_cxuWHEBI"; // YouTube API Key

let activityLog = [];
let activeVideoId = null;
let startTime = null;
let lastLoggedTime = 0;

// ========== COMMON FUNCTIONS ==========

function logActivity(url, title) {
  const log = { url, title, timestamp: Date.now() };
  activityLog.push(log);
  if (activityLog.length > MAX_HISTORY) activityLog.shift();

  chrome.storage.local.set({ activityLog }, () => {
    console.log("[BG] Stored activity:", log);
  });
}

function showToastOnTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const tabId = tabs[0].id;

    chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
        if (document.getElementById("smart-toast")) return;
        const toast = document.createElement("div");
        toast.id = "smart-toast";
        toast.innerText = msg;

        toast.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #1e1e1e;
          color: white;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 16px;
          z-index: 999999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          opacity: 0;
          transition: opacity 0.3s ease;
          max-width: 90%;
          text-align: center;
        `;

        const progressBar = document.createElement("div");
        progressBar.style.cssText = `
          position: absolute;
          bottom: 0;
          left: 0;
          height: 4px;
          width: 100%;
          background: #00bfff;
          transform-origin: left;
          animation: toast-progress 20s linear forwards;
        `;
        toast.appendChild(progressBar);

        const style = document.createElement("style");
        style.textContent = `
          @keyframes toast-progress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = "1");

        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => {
            toast.remove();
            style.remove();
          }, 500);
        }, 20000);
      },
      args: [message]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Toast injection error:", chrome.runtime.lastError.message);
      } else {
        console.log("[BG] Toast injected successfully.");
      }
    });
  });
}

// ========== YOUTUBE TRACKING ==========

async function fetchVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const snippet = data.items[0].snippet;
      return {
        videoId,
        title: snippet.title,
        category: snippet.categoryId || "Unknown"
      };
    }
  } catch (err) {
    console.error("[BG] Failed to fetch video details:", err);
  }
  return null;
}

function updateWatchTime(videoId, category, watchTime) {
  if (watchTime < 2) return;

  chrome.storage.local.get(["categoryData"], (data) => {
    let categoryData = data.categoryData || {};

    if (!categoryData[category]) {
      categoryData[category] = { count: 0, totalWatchTime: 0 };
    }

    if (videoId !== activeVideoId) {
      categoryData[category].count += 1;
    }

    categoryData[category].totalWatchTime += watchTime;

    chrome.storage.local.set({ categoryData }, () => {
      console.log("[BG] Updated YouTube category:", category, categoryData[category]);
    });
  });
}

// ========== AI NUDGE ==========

async function fetchAINudge(logs) {
  const prompt =
    `Based on the recent web pages the user visited, identify if the activity is productive (e.g., learning, coding, researching etc) or unproductive (e.g., social media, entertainment, etc). For prodictive tasks encouraging messages to the user and for unproductive tasks give a motivational message.Just give the nudge only no extra content/message.\n\n` +
    // `Then generate a short 1-line motivational nudge to help the user stay focused.Just give the nudge only no extra content/message.\n\n` +
    logs.map((l, i) => `${i + 1}. ${l.title} (${l.url})`).join("\n");
// logs.map((l, i) => console.log(`[${i + 1}] ${l.title} (${l.url})`));
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are a productivity assistant that nudges users based on recent browsing activity."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await res.json();

    if (res.status === 429 || data.error) {
      const errMsg = data?.error?.message || "Rate limit or API error.";
      console.error("[BG] AI error:", errMsg);
      showToastOnTab(errMsg);
      return;
    }

    const message = data.choices?.[0]?.message?.content || "Stay focused!";
    chrome.storage.local.set({ lastNudge: message });
    chrome.runtime.sendMessage({ type: "NUDGE", nudge: message });
    showToastOnTab("✅ AI Nudge: " + message);
  } catch (err) {
    console.error("[BG] AI nudge fetch failed:", err);
    showToastOnTab("AI fetch error: " + err.message);
  }
}

// ========== LISTENERS ==========

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.startsWith("http")) {
    logActivity(tab.url, tab.title || "Untitled");

    // YouTube detection
    if (tab.url.includes("youtube.com/watch")) {
      const videoId = new URLSearchParams(new URL(tab.url).search).get("v");
      if (videoId && videoId !== activeVideoId) {
        fetchVideoDetails(videoId).then((activity) => {
          if (activity) {
            if (activeVideoId && startTime) {
              let watchDuration = Math.floor((Date.now() - startTime) / 1000);
              updateWatchTime(activeVideoId, activity.category, watchDuration);
            }
            activeVideoId = videoId;
            startTime = Date.now();
            lastLoggedTime = 0;
          }
        });
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeVideoId && startTime) {
    let watchDuration = Math.floor((Date.now() - startTime) / 1000);
    if (watchDuration > lastLoggedTime) {
      fetchVideoDetails(activeVideoId).then((activity) => {
        if (activity) {
          updateWatchTime(activeVideoId, activity.category, watchDuration);
        }
      });
      lastLoggedTime = watchDuration;
    }
    activeVideoId = null;
    startTime = null;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REFRESH_NUDGE") {
    chrome.storage.local.get("activityLog", (data) => {
      const logs = data.activityLog || [];
      if (logs.length > 0) fetchAINudge(logs.slice(-MAX_HISTORY));
    });
  }
});

let intervalId = null;

function startNudgeInterval() {
  if (intervalId) clearInterval(intervalId);

  chrome.storage.local.get("nudgeInterval", (data) => {
    const intervalMin = data.nudgeInterval || 1;

    intervalId = setInterval(() => {
      chrome.storage.local.get("activityLog", (res) => {
        const logs = res.activityLog || [];
        if (logs.length > 0) {
          fetchAINudge(logs.slice(-MAX_HISTORY));
        }
      });
    }, intervalMin * 60 * 1000);

    console.log(`[BG] Nudge interval started: Every ${intervalMin} min(s)`);
  });
}

// Start on load
startNudgeInterval();

// React when user updates interval via popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.nudgeInterval) {
    console.log("[BG] Nudge interval updated by user:", changes.nudgeInterval.newValue);
    showToastOnTab("✅ Interval updated to " + changes.nudgeInterval.newValue + " min");
    startNudgeInterval();
  }
});

