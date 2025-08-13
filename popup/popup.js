document.addEventListener('DOMContentLoaded', function() {
  const storageList = document.getElementById('storage-list');
  const searchInput = document.getElementById('search-input');
  const storageTypeSelect = document.getElementById('storage-type');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const sectionTitle = document.getElementById('section-title');

  let currentData = {
    cookies: [],
    localStorage: {},
    sessionStorage: {}
  };

  // Load all storage data
  async function loadAllStorage() {
    // Load cookies
    currentData.cookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });

    // Load localStorage and sessionStorage through content script
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (tab && tab.id) {
      try {
        const response = await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          func: () => {
            return {
              localStorage: JSON.parse(JSON.stringify(localStorage)),
              sessionStorage: JSON.parse(JSON.stringify(sessionStorage))
            };
          }
        });
        
        if (response && response[0] && response[0].result) {
          currentData.localStorage = response[0].result.localStorage || {};
          currentData.sessionStorage = response[0].result.sessionStorage || {};
        }
      } catch (error) {
        console.error('Error accessing storage:', error);
      }
    }

    renderStorageItems();
  }

  // Render storage items based on current filters
  function renderStorageItems(filter = '') {
    storageList.innerHTML = '';
    const storageType = storageTypeSelect.value;
    const searchTerm = filter.toLowerCase();

    sectionTitle.textContent = storageType === 'all' ? 'All Storage Items' : 
                             `${storageType.charAt(0).toUpperCase() + storageType.slice(1)} Items`;

    if (storageType === 'all' || storageType === 'cookies') {
      currentData.cookies
        .filter(cookie => 
          cookie.name.toLowerCase().includes(searchTerm) || 
          cookie.value.toLowerCase().includes(searchTerm) ||
          cookie.domain.toLowerCase().includes(searchTerm)
        .forEach(cookie => {
          const item = createCookieElement(cookie);
          storageList.appendChild(item);
        });
    }

    if (storageType === 'all' || storageType === 'localStorage') {
      Object.entries(currentData.localStorage)
        .filter(([key, value]) => 
          key.toLowerCase().includes(searchTerm) || 
          String(value).toLowerCase().includes(searchTerm))
        .forEach(([key, value]) => {
          const item = createStorageElement('localStorage', key, value);
          storageList.appendChild(item);
        });
    }

    if (storageType === 'all' || storageType === 'sessionStorage') {
      Object.entries(currentData.sessionStorage)
        .filter(([key, value]) => 
          key.toLowerCase().includes(searchTerm) || 
          String(value).toLowerCase().includes(searchTerm))
        .forEach(([key, value]) => {
          const item = createStorageElement('sessionStorage', key, value);
          storageList.appendChild(item);
        });
    }
  }

  // Create DOM element for a cookie
  function createCookieElement(cookie) {
    const item = document.createElement('div');
    item.className = 'storage-item';
    item.dataset.type = 'cookie';
    item.dataset.key = cookie.name;
    
    const valueStr = typeof cookie.value === 'object' ? 
      JSON.stringify(cookie.value, null, 2) : 
      String(cookie.value);

    item.innerHTML = `
      <div class="storage-item-header">
        <span class="storage-item-key">${cookie.name}</span>
        <div class="storage-item-actions">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
          <button class="copy-btn">Copy</button>
        </div>
      </div>
      <div class="storage-item-meta">
        <div><strong>Domain:</strong> ${cookie.domain}</div>
        <div><strong>Path:</strong> ${cookie.path}</div>
        <div><strong>Expires:</strong> ${cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : 'Session'}</div>
      </div>
      <div class="storage-item-value">${valueStr}</div>
    `;

    return item;
  }

  // Create DOM element for localStorage/sessionStorage items
  function createStorageElement(type, key, value) {
    const item = document.createElement('div');
    item.className = 'storage-item';
    item.dataset.type = type;
    item.dataset.key = key;
    
    let displayValue;
    try {
      // Try to parse as JSON for pretty printing
      const parsed = JSON.parse(value);
      displayValue = `<div class="json-viewer">${JSON.stringify(parsed, null, 2)}</div>`;
    } catch {
      displayValue = `<div class="storage-item-value">${value}</div>`;
    }

    item.innerHTML = `
      <div class="storage-item-header">
        <span class="storage-item-key">${key}</span>
        <div class="storage-item-actions">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
          <button class="copy-btn">Copy</button>
        </div>
      </div>
      ${displayValue}
    `;

    return item;
  }

  // Handle edit functionality
  function setupEditHandler(item) {
    const editBtn = item.querySelector('.edit-btn');
    const valueElement = item.querySelector('.storage-item-value, .json-viewer');
    const originalValue = valueElement.textContent.trim();
    
    editBtn.addEventListener('click', async () => {
      if (item.classList.contains('edit-mode')) {
        // Save changes
        const newValue = valueElement.value;
        const type = item.dataset.type;
        const key = item.dataset.key;
        
        try {
          if (type === 'cookie') {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            await chrome.cookies.set({
              url: `https://${tab.url.split('/')[2]}`,
              name: key,
              value: newValue,
              path: '/'
            });
          } else if (type === 'localStorage' || type === 'sessionStorage') {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            await chrome.scripting.executeScript({
              target: {tabId: tab.id},
              func: (type, key, value) => {
                if (type === 'localStorage') {
                  localStorage.setItem(key, value);
                } else {
                  sessionStorage.setItem(key, value);
                }
              },
              args: [type, key, newValue]
            });
          }
          
          // Update UI
          valueElement.textContent = newValue;
          if (valueElement.classList.contains('json-viewer')) {
            try {
              valueElement.textContent = JSON.stringify(JSON.parse(newValue), null, 2);
            } catch {
              valueElement.textContent = newValue;
            }
          }
          item.classList.remove('edit-mode');
          editBtn.textContent = 'Edit';
          loadAllStorage(); // Refresh data
        } catch (error) {
          console.error('Error updating value:', error);
          valueElement.textContent = originalValue;
          item.classList.remove('edit-mode');
          editBtn.textContent = 'Edit';
        }
      } else {
        // Enter edit mode
        item.classList.add('edit-mode');
        editBtn.textContent = 'Save';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'edit-textarea';
        textarea.value = originalValue;
        textarea.style.width = '100%';
        textarea.style.minHeight = '100px';
        
        valueElement.replaceWith(textarea);
      }
    });
  }

  // Handle delete functionality
  function setupDeleteHandler(item) {
    const deleteBtn = item.querySelector('.delete-btn');
    
    deleteBtn.addEventListener('click', async () => {
      const type = item.dataset.type;
      const key = item.dataset.key;
      
      try {
        if (type === 'cookie') {
          const cookie = currentData.cookies.find(c => c.name === key);
          if (cookie) {
            await chrome.cookies.remove({
              url: `https://${cookie.domain}`,
              name: key
            });
          }
        } else if (type === 'localStorage' || type === 'sessionStorage') {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: (type, key) => {
              if (type === 'localStorage') {
                localStorage.removeItem(key);
              } else {
                sessionStorage.removeItem(key);
              }
            },
            args: [type, key]
          });
        }
        
        item.remove();
        loadAllStorage(); // Refresh data
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    });
  }

  // Handle copy functionality
  function setupCopyHandler(item) {
    const copyBtn = item.querySelector('.copy-btn');
    
    copyBtn.addEventListener('click', () => {
      const type = item.dataset.type;
      const key = item.dataset.key;
      let value;
      
      if (type === 'cookie') {
        const cookie = currentData.cookies.find(c => c.name === key);
        value = cookie ? cookie.value : '';
      } else {
        value = type === 'localStorage' ? 
          currentData.localStorage[key] : 
          currentData.sessionStorage[key];
      }
      
      navigator.clipboard.writeText(value)
        .then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
        });
    });
  }

  // Export data to JSON file
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(currentData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportName = 'storage_export_' + new Date().toISOString().slice(0, 10) + '.json';
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', exportName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Import data from JSON file
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Import cookies
        if (data.cookies && Array.isArray(data.cookies)) {
          for (const cookie of data.cookies) {
            try {
              await chrome.cookies.set({
                url: `https://${cookie.domain}`,
                name: cookie.name,
                value: cookie.value,
                path: cookie.path || '/',
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate,
                sameSite: cookie.sameSite
              });
            } catch (error) {
              console.error(`Error importing cookie ${cookie.name}:`, error);
            }
          }
        }
        
        // Import localStorage
        if (data.localStorage && typeof data.localStorage === 'object') {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: (storageData) => {
              for (const [key, value] of Object.entries(storageData)) {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              }
            },
            args: [data.localStorage]
          });
        }
        
        // Import sessionStorage
        if (data.sessionStorage && typeof data.sessionStorage === 'object') {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: (storageData) => {
              for (const [key, value] of Object.entries(storageData)) {
                sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              }
            },
            args: [data.sessionStorage]
          });
        }
        
        // Refresh the view
        loadAllStorage();
        alert('Import completed successfully!');
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  });

  // Setup event delegation for dynamically created elements
  storageList.addEventListener('click', (event) => {
    const item = event.target.closest('.storage-item');
    if (!item) return;
    
    if (event.target.classList.contains('edit-btn')) {
      setupEditHandler(item);
    } else if (event.target.classList.contains('delete-btn')) {
      setupDeleteHandler(item);
    } else if (event.target.classList.contains('copy-btn')) {
      setupCopyHandler(item);
    }
  });

  // Search functionality
  searchInput.addEventListener('input', () => {
    renderStorageItems(searchInput.value);
  });

  // Filter by storage type
  storageTypeSelect.addEventListener('change', () => {
    renderStorageItems(searchInput.value);
  });

  // Real-time updates
  chrome.cookies.onChanged.addListener(() => {
    loadAllStorage();
  });

  // Listen for storage changes in the inspected page
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'storageUpdated') {
      loadAllStorage();
    }
  });

  // Initial load
  loadAllStorage();

  // Set up a content script to monitor storage changes
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: () => {
          // Monitor localStorage changes
          const originalSetItem = localStorage.setItem;
          localStorage.setItem = function(key, value) {
            originalSetItem.apply(this, arguments);
            window.dispatchEvent(new CustomEvent('localStorageChanged', {detail: {key, value}}));
          };

          const originalRemoveItem = localStorage.removeItem;
          localStorage.removeItem = function(key) {
            originalRemoveItem.apply(this, arguments);
            window.dispatchEvent(new CustomEvent('localStorageChanged', {detail: {key, value: null}}));
          };

          // Monitor sessionStorage changes
          const originalSessionSetItem = sessionStorage.setItem;
          sessionStorage.setItem = function(key, value) {
            originalSessionSetItem.apply(this, arguments);
            window.dispatchEvent(new CustomEvent('sessionStorageChanged', {detail: {key, value}}));
          };

          const originalSessionRemoveItem = sessionStorage.removeItem;
          sessionStorage.removeItem = function(key) {
            originalSessionRemoveItem.apply(this, arguments);
            window.dispatchEvent(new CustomEvent('sessionStorageChanged', {detail: {key, value: null}}));
          };

          // Listen for changes and notify extension
          window.addEventListener('localStorageChanged', () => {
            chrome.runtime.sendMessage({type: 'storageUpdated'});
          });

          window.addEventListener('sessionStorageChanged', () => {
            chrome.runtime.sendMessage({type: 'storageUpdated'});
          });
        }
      });
    }
  });
});
