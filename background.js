chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Activity Tracker Extension installed.');
});

// Function to fetch video details using the YouTube API
async function fetchVideoDetails(videoId) {
  const apiKey = 'AIzaSyDUzuIanvjZCfSB-CzwOwT1ZX_cxuWHEBI'; // Replace with your API key
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.items.length > 0) {
      const videoDetails = data.items[0].snippet;
      return {
        videoId: videoId,
        title: videoDetails.title,
        description: videoDetails.description,
        category: videoDetails.categoryId, // Category ID
        timestamp: Date.now(),
      };
    } else {
      console.error('No video found.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Listen for updates in YouTube video URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes("youtube.com/watch")) {
    const videoId = new URLSearchParams(new URL(changeInfo.url).search).get("v");
    if (videoId) {
      fetchVideoDetails(videoId).then((activity) => {
        if (activity) {
          // Track category counts and watch times in local storage
          chrome.storage.local.get(["categoryData"], (data) => {
            let categoryData = data.categoryData || {};

            // Initialize or update the category data
            if (!categoryData[activity.category]) {
              categoryData[activity.category] = { count: 0, totalWatchTime: 0 };
            }

            // Increment count and add watch time (e.g., using video duration or a fixed duration for now)
            categoryData[activity.category].count += 1;
            categoryData[activity.category].totalWatchTime += 10; // Assume 10 minutes watch time for each video (adjust as needed)

            // Log the updated data
            console.log('Updated category data:', categoryData);

            // Save the updated category data back to storage
            chrome.storage.local.set({ categoryData: categoryData });
          });
        }
      });
    }
  }
});
