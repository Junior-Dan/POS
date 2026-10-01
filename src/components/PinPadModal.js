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
  `;
}
