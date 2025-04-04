console.log("Background script loaded.");

// Store active video details
let activeVideoId = null;
let startTime = null;
let lastLoggedTime = 0; // Prevents multiple loggings

// Function to fetch video details using YouTube API
async function fetchVideoDetails(videoId) {
  console.log(`Fetching details for video ID: ${videoId}`);

  const apiKey = 'AIzaSyDUzuIanvjZCfSB-CzwOwT1ZX_cxuWHEBI'; // Replace with your actual API key
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    console.log("API request sent.");

    const data = await response.json();
    console.log("API response received:", data);

    if (data.items && data.items.length > 0) {
      const videoDetails = data.items[0].snippet;
      console.log("Video details fetched:", videoDetails);

      return {
        videoId: videoId,
        title: videoDetails.title,
        category: videoDetails.categoryId || "Unknown", // Handle missing category
      };
    } else {
      console.warn("No video found for ID:", videoId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching video details:", error);
    return null;
  }
}

// Function to update watch time in storage
function updateWatchTime(videoId, category, watchTime) {
  if (watchTime < 2) {
    console.log(`Ignoring watch time <2s for video ${videoId}`);
    return; // Prevents accidental miscounting
  }

  chrome.storage.local.get(["categoryData"], (data) => {
    let categoryData = data.categoryData || {};

    // Ensure category exists in storage
    if (!categoryData[category]) {
      categoryData[category] = { count: 0, totalWatchTime: 0 };
    }

    // Update only if it's a valid session
    if (videoId !== activeVideoId) {
      categoryData[category].count += 1;
    }

    // Add watch time
    categoryData[category].totalWatchTime += watchTime;

    console.log(`Updated category data for ${category}:`, categoryData[category]);

    // Save the updated category data
    chrome.storage.local.set({ categoryData: categoryData }, () => {
      console.log("Data successfully saved in local storage.");
    });
  });
}

// Listen for when a new YouTube video is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes("youtube.com/watch")) {
    console.log("YouTube video detected:", changeInfo.url);

    const videoId = new URLSearchParams(new URL(changeInfo.url).search).get("v");
    console.log("Extracted video ID:", videoId);

    if (videoId && videoId !== activeVideoId) {
      fetchVideoDetails(videoId).then((activity) => {
        if (activity) {
          console.log("Activity fetched:", activity);

          // Log previous video watch time
          if (activeVideoId && startTime) {
            let watchDuration = Math.floor((Date.now() - startTime) / 1000); // Convert to seconds
            console.log(`Switching videos. Updating watch time: ${watchDuration} seconds`);

            updateWatchTime(activeVideoId, activity.category, watchDuration);
          }

          // Start tracking new video
          activeVideoId = videoId;
          startTime = Date.now();
          lastLoggedTime = 0;
        } else {
          console.warn("No activity data returned.");
        }
      });
    }
  }
});

// Listen for tab closure (to track the final watch time)
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (activeVideoId && startTime) {
    let watchDuration = Math.floor((Date.now() - startTime) / 1000); // Convert to seconds

    if (watchDuration > lastLoggedTime) { // Prevent duplicate logging
      console.log(`YouTube tab closed. Updating watch time: ${watchDuration} seconds`);

      fetchVideoDetails(activeVideoId).then((activity) => {
        if (activity) {
          updateWatchTime(activeVideoId, activity.category, watchDuration);
        }
      });

      lastLoggedTime = watchDuration;
    }

    // Reset active video tracking
    activeVideoId = null;
    startTime = null;
  }
});

console.log("Background script execution completed.");
