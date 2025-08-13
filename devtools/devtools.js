// Create the DevTools panel
chrome.devtools.panels.create(
  "Storage Inspector",
  "icons/icon48.png",
  "devtools/devtools.html",
  function(panel) {
    console.log("Storage Inspector panel created");
  }
);

// Communication with the inspected page
let backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page"
});

backgroundPageConnection.postMessage({
  name: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Handle messages from the background page
backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.type === 'storage-update') {
    updateStorageDisplay(message.data);
  } else if (message.type === 'sw-update') {
    updateServiceWorkersDisplay(message.data);
  } else if (message.type === 'cache-update') {
    updateCacheDisplay(message.data);
  }
});

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      const tabName = button.getAttribute('data-tab');
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // Refresh data when switching tabs
      if (tabName === 'storage') {
        refreshStorageData();
      } else if (tabName === 'service-workers') {
        refreshServiceWorkerData();
      } else if (tabName === 'cache') {
        refreshCacheData();
      }
    });
  });

  // Search functionality
  const searchBox = document.querySelector('.search-box');
  searchBox.addEventListener('input', function() {
    filterStorageItems(this.value);
  });

  // Storage type filter
  const storageTypeSelect = document.getElementById('storage-type-select');
  storageTypeSelect.addEventListener('change', function() {
    refreshStorageData();
  });

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', function() {
    const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
    if (activeTab === 'storage') {
      refreshStorageData();
    } else if (activeTab === 'service-workers') {
      refreshServiceWorkerData();
    } else if (activeTab === 'cache') {
      refreshCacheData();
    }
  });

  // Export button
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Initial load
  refreshStorageData();
});

function refreshStorageData() {
  backgroundPageConnection.postMessage({
    name: 'get-storage',
    tabId: chrome.devtools.inspectedWindow.tabId,
    storageType: document.getElementById('storage-type-select').value
  });
}

function refreshServiceWorkerData() {
  backgroundPageConnection.postMessage({
    name: 'get-service-workers',
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

function refreshCacheData() {
  backgroundPageConnection.postMessage({
    name: 'get-cache',
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

function updateStorageDisplay(data) {
  const tableBody = document.getElementById('storage-table-body');
  tableBody.innerHTML = '';

  data.forEach(item => {
    const row = document.createElement('tr');
    
    let valueDisplay;
    try {
      // Try to pretty-print JSON
      const parsed = JSON.parse(item.value);
      valueDisplay = `<div class="json-viewer">${JSON.stringify(parsed, null, 2)}</div>`;
    } catch {
      valueDisplay = item.value;
    }

    row.innerHTML = `
      <td>${item.type}</td>
      <td>${item.key}</td>
      <td>${valueDisplay}</td>
      <td>
        <button class="action-btn edit-btn" data-type="${item.type}" data-key="${item.key}">Edit</button>
        <button class="action-btn delete-btn" data-type="${item.type}" data-key="${item.key}">Delete</button>
        <button class="action-btn copy-btn" data-value="${escapeHtml(item.value)}">Copy</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });

  // Add event listeners to action buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', handleEdit);
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDelete);
  });
  
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopy);
  });
}

function updateServiceWorkersDisplay(workers) {
  const tableBody = document.getElementById('sw-table-body');
  tableBody.innerHTML = '';

  workers.forEach(worker => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${worker.scriptURL}</td>
      <td>${worker.status}</td>
      <td>${worker.scope}</td>
      <td>
        <button class="action-btn unregister-btn" data-id="${worker.id}">Unregister</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll('.unregister-btn').forEach(btn => {
    btn.addEventListener('click', handleUnregisterSW);
  });
}

function updateCacheDisplay(caches) {
  const tableBody = document.getElementById('cache-table-body');
  tableBody.innerHTML = '';

  caches.forEach(cache => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${cache.name}</td>
      <td>
        <div class="json-viewer">${cache.urls.join('\n')}</div>
      </td>
      <td>
        <button class="action-btn delete-cache-btn" data-name="${cache.name}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll('.delete-cache-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteCache);
  });
}

function filterStorageItems(searchTerm) {
  const rows = document.querySelectorAll('#storage-table-body tr');
  const term = searchTerm.toLowerCase();
  
  rows.forEach(row => {
    const key = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
    const value = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
    const type = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
    
    if (key.includes(term) || value.includes(term) || type.includes(term)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function handleEdit(event) {
  const type = event.target.getAttribute('data-type');
  const key = event.target.getAttribute('data-key');
  const row = event.target.closest('tr');
  const valueCell = row.querySelector('td:nth-child(3)');
  const originalValue = valueCell.textContent.trim();
  
  const textarea = document.createElement('textarea');
  textarea.value = originalValue;
  textarea.style.width = '100%';
  textarea.style.minHeight = '100px';
  
  valueCell.innerHTML = '';
  valueCell.appendChild(textarea);
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'action-btn';
  saveBtn.addEventListener('click', () => {
    const newValue = textarea.value;
    backgroundPageConnection.postMessage({
      name: 'update-storage',
      tabId: chrome.devtools.inspectedWindow.tabId,
      type,
      key,
      value: newValue
    });
  });
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'action-btn';
  cancelBtn.addEventListener('click', () => {
    valueCell.innerHTML = originalValue;
  });
  
  const actionsCell = row.querySelector('td:nth-child(4)');
  actionsCell.innerHTML = '';
  actionsCell.appendChild(saveBtn);
  actionsCell.appendChild(cancelBtn);
}

function handleDelete(event) {
  const type = event.target.getAttribute('data-type');
  const key = event.target.getAttribute('data-key');
  
  if (confirm(`Delete ${type} item "${key}"?`)) {
    backgroundPageConnection.postMessage({
      name: 'delete-storage',
      tabId: chrome.devtools.inspectedWindow.tabId,
      type,
      key
    });
  }
}

function handleCopy(event) {
  const value = event.target.getAttribute('data-value');
  navigator.clipboard.writeText(value).then(() => {
    event.target.textContent = 'Copied!';
    setTimeout(() => {
      event.target.textContent = 'Copy';
    }, 2000);
  });
}

function handleUnregisterSW(event) {
  const id = event.target.getAttribute('data-id');
  backgroundPageConnection.postMessage({
    name: 'unregister-sw',
    tabId: chrome.devtools.inspectedWindow.tabId,
    id
  });
}

function handleDeleteCache(event) {
  const name = event.target.getAttribute('data-name');
  backgroundPageConnection.postMessage({
    name: 'delete-cache',
    tabId: chrome.devtools.inspectedWindow.tabId,
    name
  });
}

function exportData() {
  backgroundPageConnection.postMessage({
    name: 'export-data',
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
