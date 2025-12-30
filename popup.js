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
        if (response && response.isRefreshing) {
          // Restaurar estado de refresco
          secondsInput.value = response.interval;
          updateInterfaceForRefresh(response.interval, response.remainingTime);
        } else {
          // Asegurar interfaz en estado inicial
          startBtn.style.display = 'block';
          stopBtn.style.display = 'none';
          countdownDisplay.textContent = '';
        }
      }
    );
  });

  function updateInterfaceForRefresh(seconds, remainingTime) {
    // Ocultar botón de inicio y mostrar botón de detener
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    // Deshabilitar el campo de entrada
    secondsInput.disabled = true;

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

    if (!currentTabId) {
      alert('No se pudo detectar la pestaña actual. Vuelve a intentar.');
      return;
    }

    // Pedir al background que inicie y esperar confirmación antes de mostrar UI
    chrome.runtime.sendMessage({ action: 'startRefresh', tabId: currentTabId, interval: seconds }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('startRefresh error:', chrome.runtime.lastError);
        alert('Error al comunicarse con el background. Reintenta.');
        return;
      }
      if (response && response.success) {
        updateInterfaceForRefresh(seconds, seconds);
      } else {
        alert('No se pudo iniciar el refresco. Intenta de nuevo.');
      }
    });
  });

  stopBtn.addEventListener('click', function() {
    if (!currentTabId) {
      // Restaurar UI localmente
      if (countdownInterval) clearInterval(countdownInterval);
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      countdownDisplay.textContent = '';
      return;
    }

    // Pedir al background que detenga y actualizar la UI tras confirmación
    chrome.runtime.sendMessage({ action: 'stopRefresh', tabId: currentTabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('stopRefresh error:', chrome.runtime.lastError);
      }

      // Detener intervalos
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }

      // Restaurar interfaz
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      countdownDisplay.textContent = '';
      // Habilitar el campo de entrada
      secondsInput.disabled = false;
    });
  });
});
