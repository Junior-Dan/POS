export function renderPinPadModal() {
  return `
  <div class="modal-overlay" id="pinModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Manager Authorization Required</span>
        </div>
        <button class="modal-close" onclick="closeModal('pinModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body">
        <div style="text-align:center; font-size:13.5px; color:var(--text-dim);" id="pinActionDescription">
          This high-risk action requires a Manager or Owner PIN to authorize.
        </div>
        <div class="pin-dots" id="pinDots">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
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
          <button class="pin-btn" onclick="clearPin()">C</button>
          <button class="pin-btn" onclick="pressPin('0')">0</button>
          <button class="pin-btn" onclick="submitPin()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
        </div>
        <div id="pinErrorMsg" style="color:var(--red); font-size:12px; text-align:center; font-weight:700; height:16px;"></div>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="userLoginModal">
    <div class="modal-card" style="max-width: 420px;">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
          <span>Staff PIN Login & Role Switch</span>
        </div>
        <button class="modal-close" onclick="closeModal('userLoginModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <div class="modal-body" style="gap:14px;">
        <div class="form-group">
          <label class="form-label">Select Staff Member</label>
          <select class="form-select" id="loginUserSelect" style="font-weight:700;">
          </select>
        </div>

        <div style="text-align:center; font-size:12.5px; color:var(--text-dim); font-weight:600;" id="loginPinPrompt">Enter 4-Digit PIN</div>

        <div class="pin-dots" id="loginPinDots">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
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
          <button class="pin-btn" onclick="clearLoginPin()">C</button>
          <button class="pin-btn" onclick="pressLoginPin('0')">0</button>
          <button class="pin-btn" onclick="submitLoginPin()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
        </div>
        <div id="loginPinErrorMsg" style="color:var(--red); font-size:12px; text-align:center; font-weight:700; height:16px;"></div>
      </div>
    </div>
  </div>
  `;
}
