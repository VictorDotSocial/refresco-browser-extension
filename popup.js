'use strict';

let currentTabId = null;
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', function() {
  const i18n = chrome.i18n.getMessage;
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const secondsInput = document.getElementById('seconds');
  const countdownDisplay = document.getElementById('countdown');
  const extNameEl = document.getElementById('extName');
  const developedByEl = document.getElementById('developedBy');

  // Set static localized UI strings
  try {
    const name = i18n('extName') || '';
    document.title = name;
    if (extNameEl) extNameEl.textContent = name;
    if (secondsInput) secondsInput.placeholder = i18n('seconds');
    if (startBtn) startBtn.textContent = i18n('start');
    if (stopBtn) stopBtn.textContent = i18n('stop');
    if (developedByEl) developedByEl.textContent = i18n('developed_by');
  } catch (e) {
    console.warn('i18n substitution failed', e);
  }

  // Get the current active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    currentTabId = tabs[0].id;

    // Verify if the tab is already set to refresh
    chrome.runtime.sendMessage(
      { action: 'checkRefreshStatus', tabId: currentTabId },
      (response) => {
        if (response && response.isRefreshing) {
          // Restore the interface
          secondsInput.value = response.interval;
          updateInterfaceForRefresh(response.interval, response.remainingTime);
        } else {
          // Ensure interface is in initial state
          startBtn.style.display = 'block';
          stopBtn.style.display = 'none';
          countdownDisplay.textContent = '';
        }
      }
    );
  });

  function updateInterfaceForRefresh(seconds, remainingTime) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    secondsInput.disabled = true;

    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    countdownDisplay.textContent = i18n('next_refresh', Math.ceil(remainingTime).toString());

    countdownInterval = setInterval(() => {
      remainingTime--;

      if (remainingTime <= 0) {
        remainingTime = seconds;
      }

      countdownDisplay.textContent = i18n('next_refresh', Math.ceil(remainingTime).toString());
    }, 1000);
  }

  startBtn.addEventListener('click', function() {
    const seconds = parseInt(secondsInput.value);
    
    if (isNaN(seconds) || seconds <= 0) {
      alert(i18n('invalid_seconds'));
      return;
    }

    if (!currentTabId) {
      alert(i18n('no_tab_detected'));
      return;
    }

    chrome.runtime.sendMessage({ action: 'startRefresh', tabId: currentTabId, interval: seconds }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('startRefresh error:', chrome.runtime.lastError);
        alert(i18n('comm_error'));
        return;
      }
      if (response && response.success) {
        updateInterfaceForRefresh(seconds, seconds);
      } else {
        alert(i18n('start_failed'));
      }
    });
  });

  stopBtn.addEventListener('click', function() {
    if (!currentTabId) {
      if (countdownInterval) clearInterval(countdownInterval);
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      countdownDisplay.textContent = '';
      return;
    }

    chrome.runtime.sendMessage({ action: 'stopRefresh', tabId: currentTabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('stopRefresh error:', chrome.runtime.lastError);
      }

      if (countdownInterval) {
        clearInterval(countdownInterval);
      }

      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      countdownDisplay.textContent = '';
      secondsInput.disabled = false;
    });
  });
});
