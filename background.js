'use strict';

// Objeto para almacenar los intervalos de refresco por pestaña
const refreshTabs = {};

// Función para iniciar el refresco de una pestaña
function startTabRefresh(tabId, interval) {
  // Detener cualquier refresco existente para esta pestaña
  if (refreshTabs[tabId]) {
    clearInterval(refreshTabs[tabId].timerId);
    delete refreshTabs[tabId];
  }

  // Crear un nuevo intervalo de refresco
  refreshTabs[tabId] = {
    interval: interval,
    startTime: Date.now(),
    timerId: setInterval(() => {
      // Recargar la pestaña
      chrome.tabs.reload(tabId);
      // Actualizar el tiempo de inicio para el próximo ciclo
      refreshTabs[tabId].startTime = Date.now();
    }, interval * 1000)
  };
}

// Función para detener el refresco de una pestaña
function stopTabRefresh(tabId) {
  if (refreshTabs[tabId]) {
    clearInterval(refreshTabs[tabId].timerId);
    delete refreshTabs[tabId];
  }
}

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch(message.action) {
    case 'startRefresh':
      // Solo iniciar si no hay un refresco activo
      if (!refreshTabs[message.tabId]) {
        startTabRefresh(message.tabId, message.interval);
      }
      break;
    
    case 'stopRefresh':
      stopTabRefresh(message.tabId);
      break;
    
    case 'checkRefreshStatus':
      // Responder con el estado actual del refresco para esta pestaña
      const tabStatus = refreshTabs[message.tabId];
      if (tabStatus) {
        let remainingTime = (tabStatus.startTime + (tabStatus.interval * 1000) - Date.now()) / 1000;
        // Si el tiempo restante es muy pequeño o negativo, mostrar el intervalo completo
        if (remainingTime <= 0.1) {
          remainingTime = tabStatus.interval;
        }
        sendResponse({
          isRefreshing: true,
          interval: tabStatus.interval,
          remainingTime: remainingTime
        });
      } else {
        sendResponse({ isRefreshing: false });
      }
      return true; // Indica que la respuesta será asíncrona
  }
});

// Limpiar intervalos cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  stopTabRefresh(tabId);
});
