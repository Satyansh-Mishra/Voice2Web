/**
 * VoiceReplica - Content Automation Engine
 * Runs inside webpages and performs actions
 */

'use strict';

console.log('✅ VoiceReplica Content Loaded:', location.href);


/* ============================================================================
   MAIN MESSAGE LISTENER
============================================================================ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  console.log('[Content] Received:', message);

  (async () => {

    try {

      let result;

      switch (message.type) {

        case 'SEARCH':
          result = await handleGoogleSearch(message.payload);
          break;

        case 'WEBSITE_SEARCH':
          result = await handleWebsiteSearch(message.payload);
          break;

        case 'FORM_FILL':
          result = await handleFormFill(message.payload);
          break;

        case 'BOOK_TICKET':
          result = await handleBooking(message.payload);
          break;

        case 'SUMMARIZE':
          result = await handleSummarize();
          break;

        default:
          result = {
            success: false,
            error: 'Unknown command'
          };
      }

      sendResponse(result);

    } catch (error) {

      console.error('[Content] Error:', error);

      sendResponse({
        success: false,
        error: error.message
      });
    }

  })();

  return true; // async
});


/* ============================================================================
   GOOGLE SEARCH
============================================================================ */

async function handleGoogleSearch(data) {

  const query = data.entities.query;

  if (!query) {
    throw new Error('No search query provided');
  }

  console.log('[Content] Google Search:', query);

  // Open Google if not already
  if (!location.hostname.includes('google')) {

    location.href =
      `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    return { success: true, message: 'Redirecting to Google' };
  }

  await wait(1000);

  const input = document.querySelector('input[name="q"]');

  if (!input) {
    throw new Error('Google search box not found');
  }

  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await wait(300);

  input.form.submit();

  return {
    success: true,
    message: 'Search executed'
  };
}


/* ============================================================================
   WEBSITE SEARCH BAR
============================================================================ */

async function handleWebsiteSearch(data) {

  const query = data.entities.query;

  if (!query) {
    throw new Error('No query provided');
  }

  console.log('[Content] Website Search:', query);

  const searchInput =
    document.querySelector('input[type="search"], input[name*="search"], input[placeholder*="search"]');

  if (!searchInput) {
    throw new Error('No search box found on website');
  }

  searchInput.focus();
  searchInput.value = query;

  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));

  await wait(300);

  // Try submit
  if (searchInput.form) {
    searchInput.form.submit();
  } else {
    searchInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true
    }));
  }

  return {
    success: true,
    message: 'Website search completed'
  };
}


/* ============================================================================
   FORM FILL
============================================================================ */

async function handleFormFill(data) {

  const fields = data.entities.form_fields;

  if (!fields || Object.keys(fields).length === 0) {
    throw new Error('No form fields provided');
  }

  console.log('[Content] Form Fill:', fields);

  let filled = 0;

  for (const [key, value] of Object.entries(fields)) {

    const input =
      document.querySelector(
        `input[name*="${key}"], input[id*="${key}"], textarea[name*="${key}"]`
      );

    if (!input) continue;

    input.focus();
    input.value = value;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    filled++;
  }

  return {
    success: true,
    message: `Filled ${filled} fields`
  };
}


/* ============================================================================
   BOOKING (BASIC SUPPORT)
============================================================================ */

async function handleBooking(data) {

  console.log('[Content] Booking automation');

  // Example for ticket booking
  const { from, to, date } = data.entities;

  await autoFill('from', from);
  await autoFill('to', to);
  await autoFill('date', date);

  // Try submit
  const submit =
    document.querySelector('button[type="submit"], input[type="submit"]');

  if (submit) {
    submit.click();
  }

  return {
    success: true,
    message: 'Booking form processed'
  };
}


async function autoFill(name, value) {

  if (!value) return;

  const el =
    document.querySelector(`input[name*="${name}"], input[id*="${name}"]`);

  if (!el) return;

  el.focus();
  el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  await wait(200);
}


/* ============================================================================
   PAGE SUMMARIZATION
============================================================================ */

async function handleSummarize() {

  console.log('[Content] Summarizing page');

  const text = document.body.innerText;

  const clean = text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return {
    success: true,
    summary: clean,
    message: 'Page content extracted'
  };
}


/* ============================================================================
   UTILITIES
============================================================================ */

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
