// This will be injected into the inspected page
(function() {
  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    chrome.runtime.sendMessage({type: 'storageUpdated'});
  };

  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function(key) {
    originalRemoveItem.apply(this, arguments);
    chrome.runtime.sendMessage({type: 'storageUpdated'});
  };

  // Monitor sessionStorage changes
  const originalSessionSetItem = sessionStorage.setItem;
  sessionStorage.setItem = function(key, value) {
    originalSessionSetItem.apply(this, arguments);
    chrome.runtime.sendMessage({type: 'storageUpdated'});
  };

  const originalSessionRemoveItem = sessionStorage.removeItem;
  sessionStorage.removeItem = function(key) {
    originalSessionRemoveItem.apply(this, arguments);
    chrome.runtime.sendMessage({type: 'storageUpdated'});
  };
})();
