/**
 * VoiceReplica - Router Service Worker
 * Handles intent routing and browser automation
 */

'use strict';

/* ============================================================================
   TAB UTILITIES
============================================================================ */

// Get currently active tab
function getActiveTab() {
  return new Promise((resolve, reject) => {

    chrome.tabs.query(
      { active: true, currentWindow: true },
      (tabs) => {

        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (!tabs || tabs.length === 0) {
          reject(new Error('No active tab'));
          return;
        }

        resolve(tabs[0]);
      }
    );
  });
}


// Get any usable tab
function getAnyValidTab() {
  return new Promise((resolve, reject) => {

    chrome.tabs.query({}, (tabs) => {

      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (!tabs || tabs.length === 0) {
        reject(new Error('No tabs available'));
        return;
      }

      const valid = tabs.find(t => !t.url.startsWith('chrome://'));

      if (!valid) {
        reject(new Error('No usable tab'));
        return;
      }

      resolve(valid);
    });

  });
}


// Create a new tab
function createNewTab(url = 'https://www.google.com') {

  return new Promise((resolve, reject) => {

    chrome.tabs.create({ url }, (tab) => {

      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      // Wait for full load
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {

        if (tabId === tab.id && info.status === 'complete') {

          chrome.tabs.onUpdated.removeListener(listener);

          resolve(tab);
        }

      });

    });

  });
}


// Get usable tab (active → fallback → create)
async function getUsableTab(createIfMissing = false) {

  try {
    return await getActiveTab();

  } catch {

    try {
      return await getAnyValidTab();

    } catch {

      if (createIfMissing) {

        console.log('[Router] Creating new tab...');
        return await createNewTab();
      }

      throw new Error('No usable tab found');
    }
  }
}


/* ============================================================================
   MESSAGE SENDER
============================================================================ */

async function sendToContent(payload, allowCreate = false) {

  try {

    const tab = await getUsableTab(allowCreate);

    console.log('[Router] Using tab:', tab.id);

    return new Promise((resolve, reject) => {

      chrome.tabs.sendMessage(tab.id, payload, (response) => {

        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve(response);
      });

    });

  } catch (error) {

    console.error('[Router] Send failed:', error.message);

    return {
      success: false,
      error: error.message
    };
  }
}


/* ============================================================================
   INTENT HANDLERS
============================================================================ */

async function handleSearch(data) {

  console.log('[Router] SEARCH');

  return sendToContent({
    type: 'SEARCH',
    payload: data
  }, true);
}


async function handleWebsiteSearch(data) {

  console.log('[Router] WEBSITE SEARCH');

  return sendToContent({
    type: 'WEBSITE_SEARCH',
    payload: data
  }, true);
}


async function handleFormFill(data) {

  console.log('[Router] FORM FILL');

  return sendToContent({
    type: 'FORM_FILL',
    payload: data
  }, true);
}


async function handleBooking(data) {

  console.log('[Router] BOOK TICKET');

  return sendToContent({
    type: 'BOOK_TICKET',
    payload: data
  }, true);
}


async function handleOpenSite(data) {

  console.log('[Router] OPEN SITE');

  let url = data.entities.website;

  if (!url) {
    return { success: false, error: 'No website given' };
  }

  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  const tab = await createNewTab(url);

  return {
    success: true,
    tabId: tab.id,
    message: 'Website opened'
  };
}


async function handleQnA(data) {

  console.log('[Router] QNA');

  return {
    success: true,
    message: data.message
  };
}


async function handleSummarize(data) {

  console.log('[Router] SUMMARIZE');

  return sendToContent({
    type: 'SUMMARIZE',
    payload: data
  }, true);
}


async function handleOther(data) {

  console.log('[Router] OTHER');

  return {
    success: true,
    message: data.message
  };
}


/* ============================================================================
   ROUTER
============================================================================ */

async function routeIntent(intentData) {

  const intent = intentData.intent;

  console.log('[Router] Routing intent:', intent);

  switch (intent) {

    case 'search':
      return handleSearch(intentData);

    case 'website_search':
      return handleWebsiteSearch(intentData);

    case 'form_fill':
      return handleFormFill(intentData);

    case 'book_ticket':
      return handleBooking(intentData);

    case 'open_site':
      return handleOpenSite(intentData);

    case 'qna':
      return handleQnA(intentData);

    case 'summarize':
      return handleSummarize(intentData);

    case 'other':
      return handleOther(intentData);

    default:

      console.warn('[Router] Unknown intent:', intent);

      return {
        success: false,
        error: 'Unknown intent'
      };
  }
}


/* ============================================================================
   MAIN MESSAGE LISTENER
============================================================================ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type !== 'PROCESS_INTENT') return;

  console.log('[Router] Received:', message);

  (async () => {

    try {

      const result = await routeIntent(message.data);

      sendResponse({
        success: true,
        result
      });

    } catch (error) {

      console.error('[Router] Error:', error);

      sendResponse({
        success: false,
        error: error.message
      });
    }

  })();

  return true; // async response
});


/* ============================================================================
   STARTUP LOG
============================================================================ */

console.log('✅ VoiceReplica Router Service Worker Started');
