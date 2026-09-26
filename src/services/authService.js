import { store } from '../store/CellarStore.js';
import { INITIAL_USERS } from '../data/initialUsers.js';

let pendingPinCallback = null;
let currentPinInput = "";
let isSubmittingAuthPin = false;

export function requestManagerAuth(description, onSuccess, onFailure) {
  const descEl = document.getElementById('pinActionDescription');
  const errEl = document.getElementById('pinErrorMsg');
  if (descEl) descEl.textContent = description;
  if (errEl) errEl.textContent = "";

  currentPinInput = "";
  isSubmittingAuthPin = false;
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
  if (isSubmittingAuthPin) return;
  if (currentPinInput.length < 4) {
    currentPinInput += digit;
    updatePinDots();
    if (currentPinInput.length === 4) {
      setTimeout(() => {
        if (currentPinInput.length === 4) {
          submitPin();
        }
      }, 100);
    }
  }
}

export function clearPin() {
  isSubmittingAuthPin = false;
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
  if (isSubmittingAuthPin) return;
  const errEl = document.getElementById('pinErrorMsg');
  if (!currentPinInput || currentPinInput.length < 4) return;

  isSubmittingAuthPin = true;

  const rawUsers = (store.users && store.users.length > 0) ? store.users : INITIAL_USERS;
  const userList = rawUsers.map(u => {
    const p = u.pin || INITIAL_USERS.find(iu => iu.id === u.id || iu.name.toLowerCase() === u.name.toLowerCase())?.pin;
    return { ...u, pin: p };
  });

  const normInput = normalizePin(currentPinInput);
  const foundUser = userList.find(u => u.pin && normalizePin(u.pin) === normInput);

  if (foundUser) {
    isSubmittingAuthPin = false;
    if (pendingPinCallback) pendingPinCallback(foundUser);
  } else {
    isSubmittingAuthPin = false;
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
