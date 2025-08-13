// Listen for storage changes and notify popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'storageUpdated') {
    // Notify all extension pages about the change
    chrome.runtime.sendMessage({type: 'storageChanged'});
  }
});
