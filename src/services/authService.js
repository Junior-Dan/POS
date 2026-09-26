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
  for (let i = 0; i < 4; i++) {
    const box = document.getElementById(`authPinBox${i}`);
    if (box) {
      if (i < currentPinInput.length) {
        box.classList.add('active');
        box.textContent = currentPinInput[i];
      } else {
        box.classList.remove('active');
        box.textContent = '-';
      }
    }
  }
}

function normalizePin(pinVal) {
  if (pinVal === null || pinVal === undefined) return "";
  const str = String(pinVal).trim();
  if (str.length < 4 && !isNaN(str)) return str.padStart(4, '0');
  return str;
}

export function submitPin() {
  const errEl = document.getElementById('pinErrorMsg');
  const userList = (store.users && store.users.length > 0) ? store.users : INITIAL_USERS;
  const normInput = normalizePin(currentPinInput);
  const foundUser = userList.find(u => normalizePin(u.pin) === normInput);
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
