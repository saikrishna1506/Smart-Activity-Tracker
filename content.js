chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_TOAST" && msg.message) {
      showToast(msg.message);
    }
  });
  console.log("[Content Script] Loaded on", window.location.href);

  function showToast(message) {
    // Prevent duplicates
    if (document.getElementById("smart-toast")) return;
  
    const toast = document.createElement("div");
    toast.id = "smart-toast";
    toast.innerText = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #111;
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
  
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });
  
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 4000);
  }
  