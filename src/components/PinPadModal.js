export function renderPinPadModal() {
  return `
  <div class="modal-overlay" id="pinModal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Manager Authorization Required</span>
        </div>
        <button class="modal-close" onclick="closeModal('pinModal')">✕</button>
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
          <button class="pin-btn" onclick="submitPin()">✓</button>
        </div>
        <div id="pinErrorMsg" style="color:var(--red); font-size:12px; text-align:center; font-weight:700; height:16px;"></div>
      </div>
    </div>
  </div>
  `;
}
