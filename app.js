const gate = document.getElementById('gate');
const chk1 = document.getElementById('chk1');
const chk2 = document.getElementById('chk2');
const q1 = document.getElementById('q1');
const q2 = document.getElementById('q2');
const typeConfirm = document.getElementById('typeConfirm');
const holdBtn = document.getElementById('holdToProceed');
const holdFill = document.getElementById('holdFill');
const gateNote = document.getElementById('gateNote');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const heightOut = document.getElementById('heightOut');
const heightOutFt = document.getElementById('heightOutFt');
const bestOut = document.getElementById('bestOut');
const bestOutFt = document.getElementById('bestOutFt');

let holdTimer = null;
let holdProgressTimer = null;
let passedGate = false;

function gateValid() {
  const typed = (typeConfirm.value || '').trim().toUpperCase();
  const ok = chk1.checked && chk2.checked && q1.checked && !q2.checked && typed === 'I ACCEPT';
  holdBtn.disabled = !ok;
  gateNote.textContent = ok ? 'Press and hold to continue' : 'All four items must be completed.';
}
[chk1,chk2,q1,q2,typeConfirm].forEach(el => el.addEventListener('input', gateValid));
gateValid();

holdBtn.addEventListener('touchstart', startHold);
holdBtn.addEventListener('mousedown', startHold);
holdBtn.addEventListener('touchend', cancelHold);
holdBtn.addEventListener('mouseup', cancelHold);
holdBtn.addEventListener('mouseleave', cancelHold);

function startHold(e) {
  if (holdBtn.disabled) return;
  e.preventDefault();
  clearTimeout(holdTimer);
  clearInterval(holdProgressTimer);
  holdFill.style.transition = 'width 0s';
  holdFill.style.width = '0%';
  // 1200ms hold to proceed
  const needMs = 1200;
  const start = performance.now();
  holdProgressTimer = setInterval(() => {
    const t = performance.now() - start;
    const pct = Math.min(1, t / needMs);
    holdFill.style.transition = 'width 0.05s linear';
    holdFill.style.width = `${pct*100}%`;
  }, 30);
  holdTimer = setTimeout(() => {
    clearInterval(holdProgressTimer);
    passedGate = true;
    gate.setAttribute('hidden', '');
  }, needMs);
}

function cancelHold() {
  clearTimeout(holdTimer);
  clearInterval(holdProgressTimer);
  holdFill.style.transition = 'width 0.2s ease';
  holdFill.style.width = '0%';
}

/* Safe Mode motion logic */
let running = false;
let bestHeight = 0;

// Simple high-pass filter to estimate dynamic acceleration (remove gravity)
const HP_ALPHA = 0.8;
let gx=0, gy=0, gz=0;

let lastT = 0;
let vZ = 0; // approximate vertical velocity from z-axis dynamic accel
const G = 9.80665;

function resetMetrics() {
  gx = gy = gz = 0;
  vZ = 0;
  lastT = 0;
  updateHeight(0);
}

function updateHeight(h) {
  const m = Math.max(0, h);
  const ft = m * 3.28084;
  heightOut.textContent = `${m.toFixed(2)} m`;
  heightOutFt.textContent = `${ft.toFixed(2)} ft`;
  if (m > bestHeight) {
    bestHeight = m;
    bestOut.textContent = `${bestHeight.toFixed(2)} m`;
    bestOutFt.textContent = `${(bestHeight*3.28084).toFixed(2)} ft`;
  }
}

// Permission helper (iOS)
async function ensureMotionPermission() {
  const DM = window.DeviceMotionEvent;
  if (!DM) return true;
  if (typeof DM.requestPermission === 'function') {
    try {
      const res = await DM.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

function onMotion(e) {
  if (!running) return;
  const t = performance.now();
  const dt = lastT ? (t - lastT) / 1000 : 0;
  lastT = t;

  const ag = e.accelerationIncludingGravity || {};
  let ax = ag.x || 0, ay = ag.y || 0, az = ag.z || 0;

  // High-pass to remove gravity component roughly
  gx = HP_ALPHA * (gx + ax - gx);
  gy = HP_ALPHA * (gy + ay - gy);
  gz = HP_ALPHA * (gz + az - gz);

  const dynZ = gz; // treat device Z as "up" approximately; orientation varies per device

  // Integrate dynamic accel to velocity with clamp and damping
  if (dt > 0 && Math.abs(dynZ) < 50) {
    vZ += (dynZ * 0.98) * dt; // m/s^2 approx (units depend on platform; many report in m/s^2)
    // Small damping to avoid drift
    vZ *= 0.98;
  }

  // Peak-based mapping: height ~ v^2/(2g)
  const estH = Math.max(0, (vZ*vZ) / (2*G));

  // Also allow spike mapping when user snaps up quickly without long integration
  const spike = Math.max(0, dynZ - 3.0); // ignore small movements; 3 m/s^2 over baseline
  const spikeH = spike * 0.08; // 0.08 m per m/s^2 spike (tuned for feel)

  const h = Math.max(estH, spikeH);
  updateHeight(h);
}

startBtn.addEventListener('click', async () => {
  if (!passedGate) return;
  const ok = await ensureMotionPermission();
  if (!ok) {
    alert('Motion permission denied. Safe Mode needs motion access.');
    return;
  }
  resetMetrics();
  running = true;
  window.addEventListener('devicemotion', onMotion, { passive: true });
  startBtn.disabled = true;
  stopBtn.disabled = false;
});

stopBtn.addEventListener('click', () => {
  running = false;
  window.removeEventListener('devicemotion', onMotion);
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

// Prevent accidental scroll during hold on iOS
document.addEventListener('touchmove', (e) => {
  if (!gate.hasAttribute('hidden')) e.preventDefault();
}, { passive: false });

