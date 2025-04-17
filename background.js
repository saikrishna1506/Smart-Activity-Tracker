console.log("[BG] Background loaded");

const YT_CATEGORY_MAP = {
  1: "Film & Animation", 2: "Autos & Vehicles", 10: "Music", 15: "Pets & Animals",
  17: "Sports", 18: "Short Movies", 19: "Travel & Events", 20: "Gaming",
  21: "Videoblogging", 22: "People & Blogs", 23: "Comedy", 24: "Entertainment",
  25: "News & Politics", 26: "Howto & Style", 27: "Education", 28: "Science & Technology",
  29: "Nonprofits & Activism", 30: "Movies", 31: "Anime/Animation", 32: "Action/Adventure",
  33: "Classics", 34: "Comedy", 35: "Documentary", 36: "Drama", 37: "Family", 38: "Foreign",
  39: "Horror", 40: "Sci-Fi/Fantasy", 41: "Thriller", 42: "Shorts", 43: "Shows", 44: "Trailers"
};

const NUDGE_INTERVAL_MINUTES = 1;
const MAX_HISTORY = 10;
const AI_API_KEY = "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";
const MODEL = "nvidia/llama-3.1-nemotron-nano-8b-v1:free";
const YOUTUBE_API_KEY = "AIzaSyDUzuIanvjZCfSB-CzwOwT1ZX_cxuWHEBI";

let activityLog = [];
let activeVideoId = null;
let startTime = null;
let lastLoggedTime = 0;
let isEnabled = true; // ✅ Global isEnabled flag

// ✅ Initialize isEnabled from storage
chrome.storage.local.get("extensionEnabled", (data) => {
  if (typeof data.extensionEnabled === "boolean") {
    isEnabled = data.extensionEnabled;
    console.log("[BG] Extension enabled:", isEnabled);
  }
});

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

async function fetchVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.items?.length > 0) {
      const snippet = data.items[0].snippet;
      return { videoId, title: snippet.title, category: snippet.categoryId || "Unknown" };
    }
  } catch (err) {
    console.error("[BG] Failed to fetch video details:", err);
  }
  return null;
}

function updateWatchTime(videoId, categoryId, watchTime) {
  if (watchTime < 2) return;
  const category = YT_CATEGORY_MAP[categoryId] || `Unknown (${categoryId})`;

  chrome.storage.local.get(["categoryData"], (data) => {
    let categoryData = data.categoryData || {};

    if (!categoryData[category]) {
      categoryData[category] = { count: 1, totalWatchTime: 0 };
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

async function fetchAINudge(logs) {
  const prompt =
    `You are a friendly productivity assistant. A user has been browsing websites. Based on their most recent browsing activity, decide if their behavior is focused (e.g. educational, coding, research) or distracted (e.g. entertainment, memes, shopping).
Then generate one single short nudge message to match:
- If the user is distracted, gently motivate them to refocus. Make it witty, casual, or slightly humorous. Add an emoji at the end.
- If the user is focused, acknowledge it and cheer them on — no fluff, just short encouragement. Add an emoji.

Do not mention the sites by name or explain the user's behavior.
Do not generate two messages. Pick only one based on the overall pattern.
Limit to 1 sentence. Keep it casual and conversational.\n\n` +
    logs.map((l, i) => `${i + 1}. ${l.title} (${l.url})`).join("\n");
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
          { role: "system", content: "You are a productivity assistant that nudges users based on recent browsing activity. with 1 or 2 line" },
          { role: "user", content: prompt }
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
  if (changeInfo.status === "complete" && tab.url?.startsWith("http") && isEnabled) {
    logActivity(tab.url, tab.title || "Untitled");

    if (tab.url.includes("youtube.com/watch")) {
      const videoId = new URLSearchParams(new URL(tab.url).search).get("v");
      if (videoId && videoId !== activeVideoId) {
        fetchVideoDetails(videoId).then((activity) => {
          if (activity) {
            if (activeVideoId && startTime) {
              const duration = Math.floor((Date.now() - startTime) / 1000);
              updateWatchTime(activeVideoId, activity.category, duration);
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

chrome.tabs.onRemoved.addListener(() => {
  if (activeVideoId && startTime && isEnabled) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    if (duration > lastLoggedTime) {
      fetchVideoDetails(activeVideoId).then((activity) => {
        if (activity) updateWatchTime(activeVideoId, activity.category, duration);
      });
      lastLoggedTime = duration;
    }
    activeVideoId = null;
    startTime = null;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REFRESH_NUDGE" && isEnabled) {
    chrome.storage.local.get("activityLog", (data) => {
      const logs = data.activityLog || [];
      if (logs.length > 0) fetchAINudge(logs.slice(-MAX_HISTORY));
    });
  }
});

let intervalId = null;

function startNudgeInterval() {
  if (intervalId) clearInterval(intervalId);

  chrome.storage.local.get(["nudgeInterval", "extensionEnabled"], (data) => {
    const intervalMin = data.nudgeInterval || 1;
    isEnabled = data.extensionEnabled ?? true;

    if (!isEnabled) {
      console.log("[BG] system is disabled.");
      return;
    }

    intervalId = setInterval(() => {
      chrome.storage.local.get("activityLog", (res) => {
        const logs = res.activityLog || [];
        if (logs.length > 0) fetchAINudge(logs.slice(-MAX_HISTORY));
      });
    }, intervalMin * 60 * 1000);

    console.log(`[BG] Nudge interval started: Every ${intervalMin} min(s)`);
  });
}

// ✅ Listen for toggle updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.extensionEnabled) {
    isEnabled = changes.extensionEnabled.newValue;
    console.log("[BG] Extension enabled status changed:", isEnabled);
    startNudgeInterval();
  }
  if (changes.nudgeInterval) {
    console.log("[BG] Nudge interval updated by user:", changes.nudgeInterval.newValue);
    showToastOnTab("✅ Interval updated to " + changes.nudgeInterval.newValue + " min");
    startNudgeInterval();
  }
});

// ✅ Start on load
startNudgeInterval();
