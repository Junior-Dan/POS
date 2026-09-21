import { store } from '../store/CellarStore.js';

let pendingPinCallback = null;
let currentPinInput = "";

export function requestManagerAuth(description, onSuccess, onFailure) {
  const descEl = document.getElementById('pinActionDescription');
  const errEl = document.getElementById('pinErrorMsg');
  if (descEl) descEl.textContent = description;
  if (errEl) errEl.textContent = "";

  currentPinInput = "";
  updatePinDots();

  pendingPinCallback = (user) => {
    if (user.role === 'owner' || user.role === 'manager') {
      closeModal('pinModal');
      onSuccess(user);
    } else {
      if (errEl) errEl.textContent = "Unauthorized: Manager or Owner role required!";
      if (onFailure) onFailure();
    }
  };
  openModal('pinModal');
}

export function pressPin(digit) {
  if (currentPinInput.length < 4) {
    currentPinInput += digit;
    updatePinDots();
  }
}

export function clearPin() {
  currentPinInput = "";
  updatePinDots();
}

function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < currentPinInput.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

export function submitPin() {
  const errEl = document.getElementById('pinErrorMsg');
  const foundUser = store.users.find(u => u.pin === currentPinInput);
  if (foundUser) {
    if (pendingPinCallback) pendingPinCallback(foundUser);
  } else {
    if (errEl) errEl.textContent = "Invalid PIN Entered!";
    currentPinInput = "";
    updatePinDots();
  }
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

window.pressPin = pressPin;
window.clearPin = clearPin;
window.submitPin = submitPin;
