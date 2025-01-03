// Debug logger
const debug = {
  log: (...args) => console.log('🔍 [Creator Helper]:', ...args),
  error: (...args) => console.error('❌ [Creator Helper]:', ...args),
  warn: (...args) => console.warn('⚠️ [Creator Helper]:', ...args)
};

// Move userIds to global scope
let userIds = new Set();

// Add these functions to track differences
let fileUserIds = new Set(); // Users from file
let localUserIds = new Set(); // Users from local storage

// Check if we're in the correct context (iframe)
function isInCorrectContext() {
  const isIframe = window !== window.top;
  const currentUrl = window.location.href;
  
  if (isIframe && currentUrl.includes('collabs-m.shopify.com/embedded/recruit')) {
    debug.log('In collabs iframe - correct context');
    return true;
  }
  
  debug.log('Not in collabs iframe, current context:', {
    isIframe,
    currentUrl
  });
  return false;
}

// Wait for DOM to be ready
function waitForDOM() {
  return new Promise(resolve => {
    if (document.readyState !== 'loading') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
    }
  });
}

// Function to check if Excel file exists
async function checkExcelFile() {
  try {
    const result = await chrome.storage.local.get(['excelFileExists', 'userIds']);
    return {
      exists: result.excelFileExists || false,
      userIds: result.userIds || []
    };
  } catch (e) {
    debug.error('Error checking Excel file:', e);
    return { exists: false, userIds: [] };
  }
}

// Function to extract Instagram ID from URL
function extractInstagramId(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    return pathParts[0].replace(/_$/, '');
  } catch (e) {
    debug.error('Invalid URL:', url);
    return null;
  }
}

// Function to compare sets and get differences
function getIdDifferences() {
  // Only count IDs that are in localUserIds but not in fileUserIds
  const newIds = new Set(
    [...localUserIds].filter(x => !fileUserIds.has(x))
  );

  // Also track removed IDs
  const removedIds = new Set(
    [...fileUserIds].filter(x => !localUserIds.has(x))
  );

  return {
    newIds,
    newCount: newIds.size,
    removedIds,
    removedCount: removedIds.size
  };
}

// Update the readExcelFile function
async function readExcelFile(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Get current users from Supabase
    const serverUsers = await window.supabaseHelper.getAllUsers();
    const serverUserIds = new Set(serverUsers);
    
    // Clear and update file users
    fileUserIds.clear();
    const newUsersToAdd = [];
    
    // Process Excel data
    for (const row of jsonData) {
      if (row.UserID && row.UserID !== 'example_user') {
        fileUserIds.add(row.UserID);
        // Check if user needs to be added to Supabase
        if (!serverUserIds.has(row.UserID)) {
          newUsersToAdd.push(row.UserID);
        }
      }
    }
    
    // Automatically add new users to Supabase
    if (newUsersToAdd.length > 0) {
      const loadingMsg = document.createElement('div');
      loadingMsg.className = 'loading-progress';
      loadingMsg.innerHTML = `
        <div class="progress-spinner"></div>
        <div>Adding ${newUsersToAdd.length} new users to database...</div>
      `;
      document.body.appendChild(loadingMsg);
      
      try {
        let successCount = 0;
        for (const userId of newUsersToAdd) {
          const success = await window.supabaseHelper.addUser(userId);
          if (success) {
            successCount++;
            // Update progress
            loadingMsg.innerHTML = `
              <div class="progress-spinner"></div>
              <div>Added ${successCount} of ${newUsersToAdd.length} users...</div>
            `;
          }
        }
        
        loadingMsg.innerHTML = `Successfully added ${successCount} new users`;
        setTimeout(() => loadingMsg.remove(), 3000);
        
        // Refresh server users and update UI
        const updatedServerUsers = await window.supabaseHelper.getAllUsers();
        userIds = new Set(updatedServerUsers);
        localUserIds = new Set(updatedServerUsers);
        
        // Force update all cards
        const cards = document.querySelectorAll('div._CreatorCard_8hb3a_1');
        cards.forEach(card => {
          const userId = card.getAttribute('data-instagram-id');
          if (userId) {
            if (userIds.has(userId)) {
              card.classList.add('existing-user');
              const button = card.querySelector('.custom-toggle-button');
              if (button) {
                button.classList.add('active');
                button.innerText = 'Remove';
              }
            } else {
              card.classList.remove('existing-user');
              const button = card.querySelector('.custom-toggle-button');
              if (button) {
                button.classList.remove('active');
                button.innerText = 'Add';
              }
            }
          }
        });
        
        // Update user count
        updateUserCount();
        
      } catch (error) {
        debug.error('Error adding new users:', error);
        loadingMsg.innerHTML = 'Error adding users';
        loadingMsg.classList.add('error');
        setTimeout(() => loadingMsg.remove(), 3000);
      }
    }
    
    // Update local storage
    await chrome.storage.local.set({ 
      userIds: Array.from(userIds),
      excelFileExists: true,
      lastUpdate: new Date().toISOString()
    });

    return Array.from(userIds);
  } catch (e) {
    debug.error('Error reading Excel file:', e);
    return [];
  }
}

// Function to update UI based on Excel data
function updateUIFromExcel() {
  const cards = document.querySelectorAll('div._CreatorCard_8hb3a_1');
  cards.forEach(card => {
    const userId = card.getAttribute('data-instagram-id');
    if (userId && userIds.has(userId)) {
      card.classList.add('existing-user');
      
      const button = card.querySelector('.custom-toggle-button');
      if (button) {
        button.classList.add('active');
        button.innerText = 'Remove';
      }
    }
  });
}

// Add loading animation styles and button state management
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = '<span class="spinner"></span>';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerText = userIds.has(button.getAttribute('data-user-id')) ? 'Remove' : 'Add';
  }
}

// Update createToggleButton function
function createToggleButton(userId, card) {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'custom-button-container';
  
  const toggleButton = document.createElement('button');
  toggleButton.className = `custom-toggle-button ${userIds.has(userId) ? 'active' : ''}`;
  toggleButton.innerText = userIds.has(userId) ? 'Remove' : 'Add';
  toggleButton.setAttribute('data-user-id', userId);
  
  toggleButton.onclick = async () => {
    try {
      setButtonLoading(toggleButton, true);
      showSavingStatus(true);
      
      if (userIds.has(userId)) {
        // Remove from Supabase
        const success = await window.supabaseHelper.removeUser(userId);
        if (!success) throw new Error('Failed to remove user from Supabase');
        
        userIds.delete(userId);
        localUserIds.delete(userId);
        toggleButton.classList.remove('active');
        card.classList.remove('existing-user');
      } else {
        // Add to Supabase
        const success = await window.supabaseHelper.addUser(userId);
        if (!success) throw new Error('Failed to add user to Supabase');
        
        userIds.add(userId);
        localUserIds.add(userId);
        toggleButton.classList.add('active');
        card.classList.add('existing-user');
      }
      
      // Update local storage
      await chrome.storage.local.set({ 
        userIds: Array.from(userIds),
        lastUpdate: new Date().toISOString()
      });
      
      await updateUserCount();
      
    } catch (e) {
      debug.error('Failed to update user:', e);
      // Show error to user
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.innerText = 'Failed to update user';
      card.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 3000);
    } finally {
      setButtonLoading(toggleButton, false);
      showSavingStatus(false);
    }
  };
  
  buttonContainer.appendChild(toggleButton);
  return buttonContainer;
}

// Add this helper function at the top of content.js
function getCreatorCardClass() {
  // Find all classes that match the pattern _CreatorCard_*
  const element = document.querySelector('div[class*="_CreatorCard_"]');
  if (element) {
    const creatorCardClass = Array.from(element.classList)
      .find(className => className.match(/_CreatorCard_\w+_1/));
    return creatorCardClass || '_CreatorCard_3oayw_1'; // Fallback to current known class
  }
  return '_CreatorCard_3oayw_1'; // Fallback to current known class
}

function getImageContainerClass() {
  // Find all classes that match the pattern _ImageContainer_*
  const element = document.querySelector('div[class*="_ImageContainer_"]');
  if (element) {
    const imageContainerClass = Array.from(element.classList)
      .find(className => className.match(/_ImageContainer_\w+_31/));
    return imageContainerClass || '_ImageContainer_3oayw_31'; // Fallback to current known class
  }
  return '_ImageContainer_3oayw_31'; // Fallback to current known class
}

// Update processCreatorCards to use dynamic class names
function processCreatorCards() {
  debug.log('Processing creator cards');
  
  const creatorCardClass = getCreatorCardClass();
  const cards = document.querySelectorAll(`div.${creatorCardClass}`);
  debug.log(`Found ${cards.length} creator cards`);

  cards.forEach((card, index) => {
    if (card.hasAttribute('data-processed')) {
      return;
    }

    const instagramLink = Array.from(card.querySelectorAll('a')).find(link => 
      link.href?.includes('instagram.com')
    );

    if (!instagramLink) {
      debug.log(`No Instagram link found in card ${index}`);
      return;
    }

    const userId = extractInstagramId(instagramLink.href);
    if (!userId) {
      debug.warn(`Could not extract user ID from ${instagramLink.href}`);
      return;
    }

    card.setAttribute('data-instagram-id', userId);
    card.setAttribute('data-creator-index', index);
    card.setAttribute('data-processed', 'true');
    
    debug.log(`Added data attributes for card ${index}, Instagram ID: ${userId}`);

    const socialLinksContainer = instagramLink.closest('.Polaris-InlineStack');
    if (!socialLinksContainer) {
      debug.warn(`No social links container found for ${userId}`);
      return;
    }

    const toggleButton = createToggleButton(userId, card);
    socialLinksContainer.appendChild(toggleButton);

    if (userIds.has(userId)) {
      card.classList.add('existing-user');
    }
  });
}

// Update updateExcelFile function
async function updateExcelFile() {
  try {
    // Get all current user IDs (excluding example_user)
    const currentUsers = Array.from(userIds)
      .filter(id => id !== 'example_user');

    debug.log('Updating Excel with users:', currentUsers);

    // Create data array with header
    const data = [
      ['UserID'], // Header row
      ...currentUsers.map(id => [id]) // Data rows
    ];

    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Instagram Users");

    if (currentUsers.length > 0) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
    }

    // Write to array buffer
    const wbout = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array'
    });

    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(wbout);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64data = btoa(binary);

    // Send to background script
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'saveFile',
        data: base64data,
        filename: 'instagram_users.xlsx'
      }, response => {
        if (response && response.success) {
          debug.log('Excel file saved successfully');
          // Update fileUserIds to match current state after successful save
          fileUserIds = new Set(userIds);
          resolve();
        } else {
          const error = response ? response.error : 'Unknown error';
          debug.error('Error saving Excel file:', error);
          reject(error);
        }
      });
    });

    // Update storage after successful save
    await chrome.storage.local.set({ 
      userIds: Array.from(userIds),
      excelFileExists: true,
      lastUpdate: new Date().toISOString()
    });

    // After successful save, update the status message
    const statusMessage = document.querySelector('.file-status-message');
    if (statusMessage) {
      statusMessage.innerText = `Excel file loaded with ${userIds.size} users`;
    }

    // Update difference UI
    updateDifferenceUI();

    return true;
  } catch (e) {
    debug.error('Error creating Excel file:', e);
    throw e;
  }
}

// Function to create template Excel file
async function createTemplate() {
  try {
    const wsData = [
      ['UserID'], // Single header
      ['example_user'] // Example row
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Instagram Users");

    const range = XLSX.utils.decode_range(ws['!ref']);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    const wbout = XLSX.write(wb, { 
      bookType: 'xlsx',
      type: 'array'
    });

    // Convert to base64
    const base64data = btoa(String.fromCharCode.apply(null, new Uint8Array(wbout)));

    // Send to background script
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'saveFile',
        data: base64data,
        filename: 'instagram_users.xlsx'
      }, response => {
        if (response && response.success) {
          debug.log('Template file saved successfully');
          resolve();
        } else {
          const error = response ? response.error : 'Unknown error';
          debug.error('Error saving template file:', error);
          reject(error);
        }
      });
    });

    // Update storage
    await chrome.storage.local.set({ 
      userIds: Array.from(userIds),
      excelFileExists: true,
      lastUpdate: new Date().toISOString()
    });

    debug.log('Created and loaded template file successfully');
    
    // Update UI
    addFileControls();
  } catch (e) {
    debug.error('Error creating template:', e);
  }
}

// Function to add file controls
function addFileControls() {
  // Create top buttons container
  const topButtons = document.createElement('div');
  topButtons.className = 'top-buttons-container';
  topButtons.innerHTML = `
    <button class="import-button">Import</button>
    <button class="export-button">Export</button>
  `;
  
  // Create status container
  const statusContainer = document.createElement('div');
  statusContainer.className = 'status-container';
  statusContainer.innerHTML = `
    <div class="status-box">
      <div class="status-content">
        <div class="user-count">Loading users...</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(topButtons);
  document.body.appendChild(statusContainer);
  
  // Add button handlers
  const importButton = topButtons.querySelector('.import-button');
  const exportButton = topButtons.querySelector('.export-button');
  
  importButton.onclick = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        await readExcelFile(file);
      }
      document.body.removeChild(fileInput);
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
  };
  
  exportButton.onclick = updateExcelFile;
  
  // Update user count
  updateUserCount();
}

// Add function to update user count
async function updateUserCount() {
  const userCount = document.querySelector('.user-count');
  if (!userCount) return;
  
  try {
    const serverUsers = await window.supabaseHelper.getAllUsers();
    userCount.innerText = `${serverUsers.length} users in database`;
  } catch (e) {
    userCount.innerText = 'Error loading user count';
  }
}

// Update the showSavingStatus function
function showSavingStatus(show = true) {
  const statusBox = document.querySelector('.status-box');
  if (!statusBox) return;
  
  // Remove any existing notification
  const existingNotification = statusBox.querySelector('.status-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  if (show) {
    const notification = document.createElement('div');
    notification.className = 'status-notification saving';
    statusBox.appendChild(notification);
  }
}

// Update the difference UI function
function updateDifferenceUI() {
  const { newIds, newCount } = getIdDifferences();
  
  // Update or create difference counter
  let diffCounter = document.querySelector('.difference-counter');
  if (!diffCounter) {
    diffCounter = document.createElement('div');
    diffCounter.className = 'difference-counter';
    
    // Find status container to append to
    const statusContainer = document.querySelector('.status-container');
    if (statusContainer) {
      statusContainer.appendChild(diffCounter);
    }
  }

  if (newCount > 0) {
    diffCounter.innerHTML = `
      <div class="diff-count">${newCount} new users to save</div>
      <button class="save-changes-button">Save to Excel</button>
    `;
    
    // Add save button handler
    const saveButton = diffCounter.querySelector('.save-changes-button');
    if (saveButton) {
      saveButton.onclick = updateExcelFile;
    }
  } else {
    diffCounter.innerHTML = 'Excel file is up to date';
  }
}

// Add function to check for existing file
async function checkForExistingFile() {
  try {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Trigger file picker
    fileInput.click();

    // Wait for file selection
    const file = await new Promise((resolve) => {
      fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
          resolve(e.target.files[0]);
        } else {
          resolve(null);
        }
      };
    });

    // Clean up
    document.body.removeChild(fileInput);

    if (file && file.name === 'instagram_users.xlsx') {
      debug.log('Found existing instagram_users.xlsx');
      await readExcelFile(file);
      return true;
    }
    return false;
  } catch (e) {
    debug.error('Error checking for existing file:', e);
    return false;
  }
}

// Keep the loading progress function
function showLoadingProgress(loaded, total) {
  let progressMsg = document.querySelector('.loading-progress');
  if (!progressMsg) {
    progressMsg = document.createElement('div');
    progressMsg.className = 'loading-progress';
    document.body.appendChild(progressMsg);
  }
  
  progressMsg.innerHTML = `
    <div class="progress-spinner"></div>
    <div>Loading users: ${loaded} of ${total}</div>
  `;
  
  if (loaded === total) {
    setTimeout(() => progressMsg.remove(), 1000);
  }
}

// Main initialization
async function main() {
  if (!isInCorrectContext()) {
    return;
  }

  await waitForDOM();

  // Try loading from Supabase first
  try {
    const serverUsers = await window.supabaseHelper.getAllUsers();
    userIds = new Set(serverUsers);
    localUserIds = new Set(serverUsers);
    debug.log('Loaded users from Supabase:', userIds);
  } catch (e) {
    debug.error('Failed to load from Supabase:', e);
    // Fallback to storage
    const result = await chrome.storage.local.get(['userIds']);
    if (result.userIds) {
      userIds = new Set(result.userIds);
      localUserIds = new Set(result.userIds);
    }
  }

  // Initialize UI
  addFileControls();
  processCreatorCards();

  // Set up observer
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        const creatorCardClass = getCreatorCardClass();
        const hasCreatorCard = Array.from(mutation.addedNodes).some(node => {
          return node.classList?.contains(creatorCardClass) ||
                 node.querySelector?.(`div.${creatorCardClass}`);
        });
        
        if (hasCreatorCard) {
          processCreatorCards();
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start the extension
main().catch(error => {
  debug.error('Error starting extension:', error);
});