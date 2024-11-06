let savedFilePath = 'instagram_users.xlsx';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['userIds'], (result) => {
    if (!result.userIds) {
      chrome.storage.local.set({ userIds: [] });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveFile') {
    try {
      // Convert base64 to data URL directly
      const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${request.data}`;

      // Always update the existing file
      chrome.downloads.download({
        url: dataUrl,
        filename: savedFilePath,
        conflictAction: 'overwrite',
        saveAs: false // Never show save dialog
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError });
        } else {
          console.log('File updated successfully');
          sendResponse({ success: true });
        }
      });

      return true; // Keep the message channel open for async response
    } catch (e) {
      console.error('Error in background script:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
}); 