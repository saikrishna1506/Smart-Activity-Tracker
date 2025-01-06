// Category ID to label mapping
const categoryMap = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "18": "Short Movies",
    "19": "Travel & Events",
    "20": "Gaming",
    "21": "Videoblogging",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
    "30": "Movies",
    "31": "Anime/Animation",
    "32": "Action/Adventure",
    "33": "Classics",
    "34": "Comedy",
    "35": "Documentary",
    "36": "Drama",
    "37": "Family",
    "38": "Foreign",
    "39": "Horror",
    "40": "Sci-Fi/Fantasy",
    "41": "Thriller",
    "42": "Shorts",
    "43": "Shows",
    "44": "Trailers"
  };
  
  // Function to render bar graph and display category data
  function renderCategoryData(categoryData) {
    const activityContainer = document.getElementById("activity");
    const barGraphContainer = document.getElementById("barGraph");
    activityContainer.innerHTML = "";
    barGraphContainer.innerHTML = "";
  
    // Log to see the category data
    console.log('Category data for rendering:', categoryData);
  
    // Loop through each category and display it
    for (const categoryId in categoryData) {
      const categoryLabel = categoryMap[categoryId] || "Uncategorized";
      const categoryInfo = categoryData[categoryId];
  
      // Create the category info display
      const categoryElement = document.createElement("div");
      categoryElement.className = "category";
      categoryElement.innerHTML = `
        <strong>Category: ${categoryLabel}</strong><br>
        Watch Count: ${categoryInfo.count} | Total Watch Time: ${categoryInfo.totalWatchTime} minutes
      `;
      activityContainer.appendChild(categoryElement);
  
      // Create bar graph for category watch time
      const barGraphElement = document.createElement("div");
      barGraphElement.className = "bar";
      barGraphElement.style.width = `${categoryInfo.totalWatchTime}px`; // Set width based on watch time
      barGraphElement.innerHTML = `${categoryLabel}: ${categoryInfo.totalWatchTime} mins`;
  
      barGraphContainer.appendChild(barGraphElement);
    }
  }
  
  // Retrieve the stored category data from local storage and render
  chrome.storage.local.get(["categoryData"], (data) => {
    const categoryData = data.categoryData || {};
    renderCategoryData(categoryData);
  });
  