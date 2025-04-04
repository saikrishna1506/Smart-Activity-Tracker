const categoryMap = {
  "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music",
  "15": "Pets & Animals", "17": "Sports", "18": "Short Movies",
  "19": "Travel & Events", "20": "Gaming", "21": "Videoblogging",
  "22": "People & Blogs", "23": "Comedy", "24": "Entertainment",
  "25": "News & Politics", "26": "Howto & Style", "27": "Education",
  "28": "Science & Technology", "29": "Nonprofits & Activism"
};

function renderCategoryData(categoryData) {
  const activityContainer = document.getElementById("activity");
  activityContainer.innerHTML = "";

  for (const categoryId in categoryData) {
    const categoryLabel = categoryMap[categoryId] || "Uncategorized";
    const categoryInfo = categoryData[categoryId];

    const categoryElement = document.createElement("div");
    categoryElement.className = "category";
    categoryElement.innerHTML = `
      <strong>${categoryLabel}</strong><br>
      Watch Count: ${categoryInfo.count} | Watch Time: ${categoryInfo.totalWatchTime} sec
    `;
    activityContainer.appendChild(categoryElement);
  }
}

function loadActivityData() {
  chrome.storage.local.get(["categoryData"], (data) => {
    renderCategoryData(data.categoryData || {});
  });
}

// Update when background.js sends data
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_POPUP") {
    loadActivityData();
  }
});

// Initial load
document.addEventListener("DOMContentLoaded", loadActivityData);

document.getElementById("clearDataBtn").addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    alert("Activity data cleared!");
    location.reload();
  });
});
