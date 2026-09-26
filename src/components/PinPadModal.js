export function renderPinPadModal() {
  return `
  <div class="modal-overlay" id="pinModal">
    <div class="modal-card" style="max-width: 380px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Manager Authorization</span>
        </div>
        <button class="modal-close" onclick="closeModal('pinModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="padding:20px;">
        <div style="text-align:center; font-size:12.5px; color:var(--text-dim);" id="pinActionDescription">
          This high-risk action requires a Manager or Owner PIN to authorize.
        </div>

        <div class="pin-display-container">
          <div class="pin-digit-box" id="authPinBox0">-</div>
          <div class="pin-digit-box" id="authPinBox1">-</div>
          <div class="pin-digit-box" id="authPinBox2">-</div>
          <div class="pin-digit-box" id="authPinBox3">-</div>
        </div>

        <div class="pin-pad">
          <button class="pin-btn" onclick="pressPin('1')">1</button>
          <button class="pin-btn" onclick="pressPin('2')">2</button>
          <button class="pin-btn" onclick="pressPin('3')">3</button>
          <button class="pin-btn" onclick="pressPin('4')">4</button>
          <button class="pin-btn" onclick="pressPin('5')">5</button>
          <button class="pin-btn" onclick="pressPin('6')">6</button>
          <button class="pin-btn" onclick="pressPin('7')">7</button>
          <button class="pin-btn" onclick="pressPin('8')">8</button>
          <button class="pin-btn" onclick="pressPin('9')">9</button>
          <button class="pin-btn action-clear" onclick="clearPin()">Clear</button>
          <button class="pin-btn" onclick="pressPin('0')">0</button>
          <button class="pin-btn action-submit" onclick="submitPin()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
        </div>
        <div id="pinErrorMsg" style="color:var(--red); font-size:12px; text-align:center; font-weight:700; height:16px; margin-top:10px;"></div>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="userLoginModal">
    <div class="modal-card" style="max-width: 400px;">
      <div class="modal-header" style="background:#0f0f12; color:#fff;">
        <div class="modal-title" style="color:#fff;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Staff Security Terminal Login</span>
        </div>
        <button class="modal-close" style="color:#fff;" onclick="closeModal('userLoginModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="gap:14px; padding:20px;">
        <div style="text-align:center;">
          <div style="font-size:15px; font-weight:800; color:var(--text);" id="loginTerminalTitle">ENTER 4-DIGIT STAFF PIN</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">Type your PIN to unlock your register & dashboard</div>
        </div>

        <div class="pin-display-container">
          <div class="pin-digit-box" id="loginPinBox0">-</div>
          <div class="pin-digit-box" id="loginPinBox1">-</div>
          <div class="pin-digit-box" id="loginPinBox2">-</div>
          <div class="pin-digit-box" id="loginPinBox3">-</div>
          <button class="pin-toggle-visibility-btn" type="button" onclick="togglePinVisibility()" title="Show/Hide PIN digits">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>

        <div class="pin-pad">
          <button class="pin-btn" onclick="pressLoginPin('1')">1</button>
          <button class="pin-btn" onclick="pressLoginPin('2')">2</button>
          <button class="pin-btn" onclick="pressLoginPin('3')">3</button>
          <button class="pin-btn" onclick="pressLoginPin('4')">4</button>
          <button class="pin-btn" onclick="pressLoginPin('5')">5</button>
          <button class="pin-btn" onclick="pressLoginPin('6')">6</button>
          <button class="pin-btn" onclick="pressLoginPin('7')">7</button>
          <button class="pin-btn" onclick="pressLoginPin('8')">8</button>
          <button class="pin-btn" onclick="pressLoginPin('9')">9</button>
          <button class="pin-btn action-clear" onclick="clearLoginPin()">Clear</button>
          <button class="pin-btn" onclick="pressLoginPin('0')">0</button>
          <button class="pin-btn action-submit" onclick="submitLoginPin()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
        </div>

        <div id="loginPinErrorMsg" style="color:var(--red); font-size:12px; text-align:center; font-weight:700; height:16px;"></div>

        <details style="border-top:1px solid var(--border-soft); padding-top:10px; font-size:12px; color:var(--text-dim);">
          <summary style="cursor:pointer; font-weight:700; color:var(--accent);">Select Staff Member (Optional)</summary>
          <div class="form-group" style="margin-top:8px;">
            <select class="form-select" id="loginUserSelect" style="font-weight:700; font-size:12px;">
            </select>
          </div>
        </details>
      </div>
    </div>
  </div>
  `;
}
