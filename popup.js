'use strict';

let currentTabId = null;
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const secondsInput = document.getElementById('seconds');
  const countdownDisplay = document.getElementById('countdown');

  // Obtener la pestaña actual
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    currentTabId = tabs[0].id;

    // Verificar el estado de refresco actual
    chrome.runtime.sendMessage(
      { action: 'checkRefreshStatus', tabId: currentTabId },
      (response) => {
        if (response.isRefreshing) {
          // Restaurar estado de refresco
          secondsInput.value = response.interval;
          updateInterfaceForRefresh(response.interval, response.remainingTime);
        }
      }
    );
  });

  function updateInterfaceForRefresh(seconds, remainingTime) {
    // Ocultar botón de inicio y mostrar botón de detener
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';

    // Limpiar cualquier intervalo existente
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Mostrar el tiempo restante inicial inmediatamente
    countdownDisplay.textContent = `Próximo refresco en: ${Math.ceil(remainingTime)} segundos`;

    // Iniciar contador de cuenta regresiva
    countdownInterval = setInterval(() => {
      remainingTime--;

      if (remainingTime <= 0) {
        remainingTime = seconds;
      }

      countdownDisplay.textContent = `Próximo refresco en: ${Math.ceil(remainingTime)} segundos`;
    }, 1000);
  }

  startBtn.addEventListener('click', function() {
    const seconds = parseInt(secondsInput.value);
    
    if (isNaN(seconds) || seconds <= 0) {
      alert('Por favor, introduce un número válido de segundos');
      return;
    }

    // Iniciar refresco
    updateInterfaceForRefresh(seconds, seconds);

    // Enviar mensaje al background script
    chrome.runtime.sendMessage({
      action: 'startRefresh',
      tabId: currentTabId,
      interval: seconds
    });
  });

  stopBtn.addEventListener('click', function() {
    // Detener intervalos
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Restaurar interfaz
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    countdownDisplay.textContent = '';

    // Enviar mensaje al background script
    chrome.runtime.sendMessage({
      action: 'stopRefresh',
      tabId: currentTabId
    });
  });
});
