'use strict';

// Key prefix para almacenamiento en chrome.storage.local
const STORAGE_PREFIX = 'refresh_';

function alarmNameForTab(tabId) {
  return `refresh-${tabId}`;
}

// Iniciar refresco: crear/actualizar alarma y persistir datos
function startTabRefresh(tabId, interval, callback) {
  const endTime = Date.now() + interval * 1000;
  const name = alarmNameForTab(tabId);

  // Guardar metadata en storage para recuperar estado si el service worker se reinicia
  const data = {};
  const key = STORAGE_PREFIX + tabId;
  data[key] = { interval, endTime };
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      console.error('storage.set failed in startTabRefresh:', chrome.runtime.lastError);
      if (typeof callback === 'function') callback(false);
      return;
    }

    // Limpiar alarma previa y crear una nueva cuando corresponda
    chrome.alarms.clear(name, () => {
      chrome.alarms.create(name, { when: endTime });
      if (typeof callback === 'function') callback(true);
    });
  });
}

// Detener refresco: borrar alarma y eliminar metadata
function stopTabRefresh(tabId, callback) {
  const name = alarmNameForTab(tabId);
  const key = STORAGE_PREFIX + tabId;
  chrome.alarms.clear(name, () => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        console.error('storage.remove failed in stopTabRefresh:', chrome.runtime.lastError);
        if (typeof callback === 'function') callback(false);
        return;
      }
      if (typeof callback === 'function') callback(true);
    });
  });
}

// Responder al popup sobre el estado actual
function handleCheckRefreshStatus(tabId, sendResponse) {
  chrome.storage.local.get(STORAGE_PREFIX + tabId, (items) => {
    const key = STORAGE_PREFIX + tabId;
    const entry = items[key];
    if (entry) {
      let remainingTime = (entry.endTime - Date.now()) / 1000;
      if (remainingTime <= 0.1) {
        remainingTime = entry.interval;
      }
      sendResponse({ isRefreshing: true, interval: entry.interval, remainingTime });
    } else {
      sendResponse({ isRefreshing: false });
    }
  });
}

// Manejar mensajes desde popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startRefresh':
      // Esperar a que se persista antes de confirmar al popup
      startTabRefresh(message.tabId, message.interval, (ok) => {
        sendResponse({ success: !!ok });
      });
      return true; // respuesta asíncrona
    case 'stopRefresh':
      stopTabRefresh(message.tabId, (ok) => {
        sendResponse({ success: !!ok });
      });
      return true; // respuesta asíncrona
    case 'checkRefreshStatus':
      // Indicamos que la respuesta será asíncrona devolviendo true
      handleCheckRefreshStatus(message.tabId, sendResponse);
      return true;
  }
});

// Cuando se dispara la alarma: recargar la pestaña y programar la próxima ejecución
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;

  const match = alarm.name.match(/^refresh-(\d+)$/);
  if (!match) return;

  const tabId = parseInt(match[1], 10);
  if (isNaN(tabId)) return;

  // Recuperar metadata (interval) para programar el siguiente alarm
  chrome.storage.local.get(STORAGE_PREFIX + tabId, (items) => {
    const key = STORAGE_PREFIX + tabId;
    const entry = items[key];
    if (!entry) return;

    // Recargar la pestaña si aún existe
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        // Pestaña no existe, limpiar
        stopTabRefresh(tabId);
        return;
      }

      chrome.tabs.reload(tabId);

      // Programar siguiente ejecución
      const nextEndTime = Date.now() + entry.interval * 1000;
      const newData = {};
      newData[key] = { interval: entry.interval, endTime: nextEndTime };
      chrome.storage.local.set(newData, () => {
        chrome.alarms.create(alarm.name, { when: nextEndTime });
      });
    });
  });
});

// Limpiar cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  stopTabRefresh(tabId);
});
