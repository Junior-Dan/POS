let pendingPinCallback = null;
let pendingPinFailure = null;
let currentPinInput = "";
let isSubmittingAuthPin = false;
// Roles allowed to approve the elevated action currently being prompted.
let requiredApproverRoles = ['owner', 'manager'];

export function requestManagerAuth(description, onSuccess, onFailure, allowedRoles) {
  const descEl = document.getElementById('pinActionDescription');
  const errEl = document.getElementById('pinErrorMsg');
  if (descEl) descEl.textContent = description;
  if (errEl) errEl.textContent = "";

  currentPinInput = "";
  isSubmittingAuthPin = false;
  requiredApproverRoles = (Array.isArray(allowedRoles) && allowedRoles.length)
    ? allowedRoles.map(r => r.toLowerCase())
    : ['owner', 'manager'];
  updatePinDots();

  pendingPinCallback = (user) => {
    closeModal('pinModal');
    onSuccess(user);
  };
  pendingPinFailure = onFailure || null;
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

export async function submitPin() {
  if (isSubmittingAuthPin) return;
  const errEl = document.getElementById('pinErrorMsg');
  if (!currentPinInput || currentPinInput.length < 4) return;

  isSubmittingAuthPin = true;
  const pin = normalizePin(currentPinInput);

  // Verify the approver PIN SERVER-SIDE against the Turso database (hashed
  // PINs, real accounts, org-scoped) — never against the seeded demo users.
  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, requiredRoles: requiredApproverRoles })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.user) {
      isSubmittingAuthPin = false;
      if (pendingPinCallback) pendingPinCallback(data.user);
      return;
    }

    isSubmittingAuthPin = false;
    if (errEl) {
      errEl.textContent = res.status === 401
        ? 'Session expired. Please log in again.'
        : (data.error || 'Invalid PIN or insufficient permissions.');
    }
    currentPinInput = "";
    updatePinDots();
    if (pendingPinFailure) pendingPinFailure();
  } catch (e) {
    isSubmittingAuthPin = false;
    if (errEl) errEl.textContent = 'Could not verify PIN. Check your connection and try again.';
    currentPinInput = "";
    updatePinDots();
    if (pendingPinFailure) pendingPinFailure();
  }
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

window.pressPin = pressPin;
window.clearPin = clearPin;
window.submitPin = submitPin;
