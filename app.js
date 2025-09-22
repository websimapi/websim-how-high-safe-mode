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
const whyLocked = document.getElementById('whyLocked');

const unlockReal = document.getElementById('unlockReal');
const startReal = document.getElementById('startReal');
const stopReal = document.getElementById('stopReal');
const realReads = document.getElementById('realReads');
const realHeightOut = document.getElementById('realHeightOut');
const realHeightOutFt = document.getElementById('realHeightOutFt');
const realBestOut = document.getElementById('realBestOut');
const realBestOutFt = document.getElementById('realBestOutFt');
const riskGate = document.getElementById('riskGate');
const rchk1 = document.getElementById('rchk1');
const rchk2 = document.getElementById('rchk2');
const riskType = document.getElementById('riskType');
const holdUnlock = document.getElementById('holdToUnlockReal');
const riskHoldFill = document.getElementById('riskHoldFill');
const riskNote = document.getElementById('riskNote');

let holdTimer = null;
let holdProgressTimer = null;
let passedGate = false;
let realUnlocked = false;

function gateValid() {
  const typed = (typeConfirm.value || '').trim().toUpperCase();
  const ok = chk1.checked && chk2.checked && typed === 'I ACCEPT';
  holdBtn.disabled = !ok;
  gateNote.textContent = ok ? 'Press and hold to continue' : 'Complete both checkboxes and type the phrase.';
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

whyLocked?.addEventListener('click', () => {
  alert('Real Throw Mode is permanently disabled to prevent injuries, property damage, and device loss. Please use Safe Mode (shake only).');
});

// Prevent accidental scroll during hold on iOS
document.addEventListener('touchmove', (e) => {
  if (!gate.hasAttribute('hidden')) e.preventDefault();
}, { passive: false });

/* Real Throw Mode logic */
function riskValid() {
  const typed = (riskType.value || '').trim().toUpperCase() === 'I ACCEPT RISK';
  const ok = rchk1.checked && rchk2.checked && typed;
  holdUnlock.disabled = !ok;
  riskNote.textContent = ok ? 'Press and hold to unlock' : 'Complete all items to enable the button.';
}
[rchk1,rchk2,riskType].forEach(el => el.addEventListener('input', riskValid));

unlockReal?.addEventListener('click', () => {
  riskGate.removeAttribute('hidden');
  riskValid();
});

holdUnlock.addEventListener('touchstart', startRiskHold);
holdUnlock.addEventListener('mousedown', startRiskHold);
holdUnlock.addEventListener('touchend', cancelRiskHold);
holdUnlock.addEventListener('mouseup', cancelRiskHold);
holdUnlock.addEventListener('mouseleave', cancelRiskHold);

let riskHoldTimer=null, riskHoldProgress=null;
function startRiskHold(e){
  if (holdUnlock.disabled) return; e.preventDefault();
  clearTimeout(riskHoldTimer); clearInterval(riskHoldProgress);
  riskHoldFill.style.transition='width 0s'; riskHoldFill.style.width='0%';
  const needMs=1800, start=performance.now();
  riskHoldProgress=setInterval(()=>{const t=performance.now()-start; riskHoldFill.style.width=`${Math.min(1,t/needMs)*100}%`;},30);
  riskHoldTimer=setTimeout(()=>{ clearInterval(riskHoldProgress); realUnlocked=true; riskGate.setAttribute('hidden','');
    unlockReal.disabled=true; startReal.hidden=false; stopReal.hidden=false; realReads.hidden=false; },needMs);
}
function cancelRiskHold(){ clearTimeout(riskHoldTimer); clearInterval(riskHoldProgress); riskHoldFill.style.transition='width 0.2s ease'; riskHoldFill.style.width='0%'; }

let realRunning=false, bestReal=0, freeStart=0, lastMag=G;
function updateReal(h){
  const m=Math.max(0,h), ft=m*3.28084;
  realHeightOut.textContent=`${m.toFixed(2)} m`; realHeightOutFt.textContent=`${ft.toFixed(2)} ft`;
  if(m>bestReal){ bestReal=m; realBestOut.textContent=`${bestReal.toFixed(2)} m`; realBestOutFt.textContent=`${(bestReal*3.28084).toFixed(2)} ft`; }
}

function onMotionReal(e){
  if(!realRunning) return;
  const ag=e.accelerationIncludingGravity||{}, ax=ag.x||0, ay=ag.y||0, az=ag.z||0;
  const mag=Math.sqrt(ax*ax+ay*ay+az*az);
  const t=performance.now();
  const free = mag < 1.5; // near free-fall
  if(!freeStart && free){ freeStart=t; }
  if(freeStart && mag > 8.0){ // re-contact
    const T=(t-freeStart)/1000; freeStart=0;
    const h = (G*T*T)/8; updateReal(h);
  }
  lastMag=mag;
}

startReal.addEventListener('click', async () => {
  if(!realUnlocked) return;
  const ok = await ensureMotionPermission(); if(!ok){ alert('Motion permission denied.'); return; }
  realRunning=true; freeStart=0; window.addEventListener('devicemotion', onMotionReal, {passive:true});
  startReal.disabled=true; stopReal.disabled=false;
});
stopReal.addEventListener('click', () => {
  realRunning=false; window.removeEventListener('devicemotion', onMotionReal);
  startReal.disabled=false; stopReal.disabled=true;
});