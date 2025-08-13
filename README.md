# crx-session-handler
Experimental extension for Chromium-based browsers  for web Storage Inspection  
You can zip this and add it as an extension to any Chromium-based browser after enabling Developer Mode.  
This can be used for malicious purposes if placed in the wrong hands, so it should only be applied in controlled,   
ethical, and authorized contexts, the code is in JS so you can check what does it do.
## THIS IS Experimental, i made it by ML model assistance.  

# Features Implemented

## 🔍 Search and Filter
- **Real-time search** across all storage types
- **Filter by storage type**: `cookies`, `localStorage`, `sessionStorage`
- **Case-insensitive search** for better match results

## ✏️ Edit Capability
- **Inline editing** for all storage items
- **JSON-aware editing** with pretty printing
- **Visual feedback** while in edit mode

## 📤📥 Export / Import
- **Export** all storage data to a `.json` file
- **Import** storage data from a `.json` file
- **Preserves metadata**, including cookie attributes and other properties

## ⚡ Real-time Updates
- **Monitors cookie changes** via `chrome.cookies.onChanged`
- **Overrides storage methods** to detect changes in `localStorage` and `sessionStorage`
- **Automatic UI updates** whenever data changes
