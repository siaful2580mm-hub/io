import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';

export interface DeviceTelemetry {
  ip: string;
  fingerprint: string;
  country: string;
  city: string;
  region: string;
  isp: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  deviceName: string;
  os: string;
  browser: string;
  screenResolution: string;
  userAgent: string;
  language: string;
  platform: string;
  cores?: number;
  memory?: number;
  touchSupport: boolean;
  online: boolean;
  timezone: string;
  referrer: string;
}

// Generate persistent WebGL, canvas & client hardware fingerprint
export function generateClientFingerprint(): string {
  try {
    let glInfo = '';
    try {
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          glInfo = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }
    } catch {
      //
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 240;
    canvas.height = 60;
    
    let canvasData = '';
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial', sans-serif";
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, 240, 60);
      ctx.fillStyle = '#EDEDED';
      ctx.fillText('DK-X-SYSTEM-ID-9923', 4, 17);
      ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
      ctx.fillText('SECURITY-DEVICE-LOCK-V2', 4, 35);
      canvasData = canvas.toDataURL();
    }

    const nav = window.navigator as any;
    const rawTokens = [
      canvasData.slice(30, 110),
      glInfo,
      nav.userAgent || '',
      nav.platform || '',
      nav.hardwareConcurrency || 'x',
      nav.deviceMemory || 'y',
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth + 'x' + (window.devicePixelRatio || 1),
      Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    ].join('###');

    // FNV-1a 32-bit to hex hash
    let hash = 2166136261;
    for (let i = 0; i < rawTokens.length; i++) {
      hash ^= rawTokens.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `fp_${hex}`;
  } catch {
    return `fp_dev_${screen.width}x${screen.height}`;
  }
}

// Detect operating system accurately
function detectOS(ua: string): string {
  if (/Windows NT 10.0/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6.3/i.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6.1/i.test(ua)) return 'Windows 7';
  if (/Macintosh; Intel Mac OS X 10[._](\d+)/i.test(ua)) {
    const match = ua.match(/Mac OS X 10[._](\d+)/i);
    return match ? `macOS 10.${match[1]}` : 'macOS';
  }
  if (/Macintosh; Intel Mac OS X 1[1-9]/i.test(ua) || /Macintosh; Intel Mac OS X [2-9]\d/i.test(ua)) return 'macOS Modern';
  if (/iPhone OS (\d+[._]\d+)/i.test(ua)) {
    const match = ua.match(/iPhone OS (\d+[._]\d+)/i);
    return `iOS ${match ? match[1].replace('_', '.') : ''}`;
  }
  if (/iPad.*OS (\d+[._]\d+)/i.test(ua)) return 'iPadOS';
  if (/Android (\d+(\.\d+)?)/i.test(ua)) {
    const match = ua.match(/Android (\d+(\.\d+)?)/i);
    return `Android ${match ? match[1] : ''}`;
  }
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

// Detect browser accurately
function detectBrowser(ua: string): string {
  if (/Edg\/(\d+[\.\d]*)/i.test(ua)) {
    const m = ua.match(/Edg\/(\d+[\.\d]*)/i);
    return `Edge ${m ? m[1].split('.')[0] : ''}`;
  }
  if (/Chrome\/(\d+[\.\d]*)/i.test(ua) && !/Edg/i.test(ua)) {
    const m = ua.match(/Chrome\/(\d+[\.\d]*)/i);
    return `Chrome ${m ? m[1].split('.')[0] : ''}`;
  }
  if (/Firefox\/(\d+[\.\d]*)/i.test(ua)) {
    const m = ua.match(/Firefox\/(\d+[\.\d]*)/i);
    return `Firefox ${m ? m[1].split('.')[0] : ''}`;
  }
  if (/Safari\/(\d+[\.\d]*)/i.test(ua) && !/Chrome/i.test(ua)) {
    const m = ua.match(/Version\/(\d+[\.\d]*)/i);
    return `Safari ${m ? m[1].split('.')[0] : ''}`;
  }
  if (/Opera|OPR\/(\d+[\.\d]*)/i.test(ua)) return 'Opera';
  return 'Browser';
}

// Detect device model & form factor
function detectDeviceType(): 'Desktop' | 'Mobile' | 'Tablet' {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

function detectDeviceName(ua: string): string {
  if (/iPhone/i.test(ua)) return 'Apple iPhone';
  if (/iPad/i.test(ua)) return 'Apple iPad';
  if (/Macintosh/i.test(ua)) return 'Apple Mac';
  if (/Samsung|SM-|GT-/i.test(ua)) return 'Samsung Device';
  if (/Pixel/i.test(ua)) return 'Google Pixel';
  if (/Xiaomi|Redmi/i.test(ua)) return 'Xiaomi';
  if (/OnePlus/i.test(ua)) return 'OnePlus';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux Machine';
  return 'Standard Device';
}

// Fetch IP and Geo Location details using trusted public API
export async function fetchClientTelemetry(): Promise<DeviceTelemetry> {
  const ua = navigator.userAgent || '';
  const fingerprint = generateClientFingerprint();
  const nav = window.navigator as any;

  let ip = 'Unknown';
  let country = 'Unknown';
  let city = 'Unknown';
  let region = 'Unknown';
  let isp = 'Unknown';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      ip = data.ip || 'Unknown';
      country = data.country_name || data.country || 'Unknown';
      city = data.city || 'Unknown';
      region = data.region || 'Unknown';
      isp = data.org || 'Unknown';
    }
  } catch {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (res.ok) {
        const d = await res.json();
        ip = d.ip || 'Unknown';
      }
    } catch {
      // Offline or network block
    }
  }

  // Backup fallback IP in localStorage for consistent device locking in development
  if (!ip || ip === 'Unknown') {
    let localIp = localStorage.getItem('dkx_detected_ip');
    if (!localIp) {
      localIp = `local_${Math.floor(Math.random() * 899 + 100)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      localStorage.setItem('dkx_detected_ip', localIp);
    }
    ip = localIp;
  } else {
    localStorage.setItem('dkx_detected_ip', ip);
  }

  const deviceType = detectDeviceType();
  const deviceName = detectDeviceName(ua);
  const os = detectOS(ua);
  const browser = detectBrowser(ua);
  const screenResolution = `${window.screen.width}×${window.screen.height} (${window.devicePixelRatio}x)`;
  const language = navigator.language || 'bn-BD';
  const platform = navigator.platform || 'Unknown';
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';

  return {
    ip,
    fingerprint,
    country,
    city,
    region,
    isp,
    deviceType,
    deviceName,
    os,
    browser,
    screenResolution,
    userAgent: ua.slice(0, 500),
    language,
    platform,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    touchSupport,
    online: navigator.onLine,
    timezone,
    referrer: document.referrer || 'Direct Entry'
  };
}

// Convert ID to safe Firestore Document ID
export function sanitizeDocId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
}

// Record or update visitor in Firestore
export async function recordVisitorTelemetry(telemetry: DeviceTelemetry): Promise<void> {
  const visitorId = sanitizeDocId(`vis_${telemetry.ip}`);

  try {
    const visitorRef = doc(db, 'visitors', visitorId);
    const now = new Date().toISOString();

    const dataToSave: Record<string, any> = {
      ip: telemetry.ip,
      fingerprint: telemetry.fingerprint,
      country: telemetry.country || 'Unknown',
      city: telemetry.city || 'Unknown',
      region: telemetry.region || 'Unknown',
      isp: telemetry.isp || 'Unknown',
      deviceType: telemetry.deviceType || 'Desktop',
      deviceName: telemetry.deviceName || 'Standard',
      os: telemetry.os || 'Unknown',
      browser: telemetry.browser || 'Unknown',
      screenResolution: telemetry.screenResolution || 'Unknown',
      userAgent: (telemetry.userAgent || '').slice(0, 500),
      createdAt: now,
      lastVisitedAt: now
    };

    try {
      const snap = await getDoc(visitorRef);
      if (snap.exists()) {
        await updateDoc(visitorRef, {
          visitCount: increment(1),
          lastVisitedAt: now
        });
        return;
      }
    } catch {
      // If getDoc not existing, proceed to setDoc
    }

    dataToSave.hasSubmittedMessage = false;
    dataToSave.visitCount = 1;
    await setDoc(visitorRef, dataToSave);
  } catch (error) {
    console.warn('Could not record visitor telemetry:', error);
  }
}

// Check if this visitor is locked from submitting (SPECIFIC TO THIS DEVICE FINGERPRINT ONLY)
// Note: We do NOT lock solely by IP so other devices on the same Wi-Fi / network are not blocked!
export async function checkSubmissionLock(ip: string, fingerprint: string): Promise<{
  isLocked: boolean;
  lockedReason?: string;
  lockedAt?: string;
}> {
  // 1. Check local storage on this specific device
  const localLock = localStorage.getItem('dkx_msg_lock');
  if (localLock) {
    try {
      const parsed = JSON.parse(localLock);
      return { isLocked: true, lockedReason: 'Local device record', lockedAt: parsed.lockedAt };
    } catch {
      // continue to remote check
    }
  }

  // 2. Check remote Firestore lock by DEVICE FINGERPRINT
  // Only blocks if THIS hardware/canvas fingerprint previously sent a message!
  const fpLockId = sanitizeDocId(`lock_fp_${fingerprint}`);
  try {
    const fpDoc = await getDoc(doc(db, 'locks', fpLockId));
    if (fpDoc.exists()) {
      const data = fpDoc.data();
      localStorage.setItem('dkx_msg_lock', JSON.stringify({ fingerprint, lockedAt: data.createdAt }));
      return { isLocked: true, lockedReason: 'Device fingerprint match', lockedAt: data.createdAt };
    }
  } catch (e) {
    console.warn('Check FP lock error', e);
  }

  return { isLocked: false };
}

// Submit single message and enforce strict device lock
export async function submitOneTimeMessage(payload: {
  name: string;
  email: string;
  telegram?: string;
  message: string;
  telemetry: DeviceTelemetry;
}): Promise<{ success: boolean; messageId: string }> {
  const { name, email, telegram, message, telemetry } = payload;
  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Double check lock for THIS device before writing
  const lockStatus = await checkSubmissionLock(telemetry.ip, telemetry.fingerprint);
  if (lockStatus.isLocked) {
    throw new Error('আপনি ইতিমধ্যে একটি বার্তা পাঠিয়েছেন। প্রতিটি ডিভাইস থেকে কেবল একবারই বার্তা পাঠানো অনুমোদিত।');
  }

  const messageDoc: Record<string, any> = {
    name: name.trim().slice(0, 120),
    email: email.trim().slice(0, 150),
    message: message.trim().slice(0, 2000),
    ip: telemetry.ip.slice(0, 64),
    fingerprint: telemetry.fingerprint.slice(0, 128),
    location: `${telemetry.city}, ${telemetry.country}`.slice(0, 150),
    deviceSummary: `${telemetry.deviceName} · ${telemetry.os} · ${telemetry.browser}`.slice(0, 200),
    status: 'unread',
    createdAt: now
  };

  if (telegram && telegram.trim()) {
    messageDoc.telegram = telegram.trim().slice(0, 100);
  }

  const pathForWrite = `messages/${messageId}`;
  try {
    // Write message to Firestore
    await setDoc(doc(db, 'messages', messageId), messageDoc);
    console.log('Message written successfully to Firestore:', messageId);
  } catch (error) {
    console.error('Failed writing message to Firestore:', error);
    handleFirestoreError(error, OperationType.CREATE, pathForWrite);
  }

  // Backup to localStorage for device resiliency
  try {
    const localStore = JSON.parse(localStorage.getItem('dkx_all_messages') || '[]');
    localStore.unshift({ id: messageId, ...messageDoc });
    localStorage.setItem('dkx_all_messages', JSON.stringify(localStore));
  } catch {
    //
  }

  // Create submission lock specifically for THIS DEVICE FINGERPRINT
  try {
    const fpLockId = sanitizeDocId(`lock_fp_${telemetry.fingerprint}`);
    await setDoc(doc(db, 'locks', fpLockId), {
      identifier: `fp_${telemetry.fingerprint}`,
      messageId: messageId,
      ip: telemetry.ip,
      createdAt: now
    });
  } catch (e) {
    console.warn('Could not write FP lock:', e);
  }

  // Set localStorage backup lock for this browser
  localStorage.setItem('dkx_msg_lock', JSON.stringify({
    fingerprint: telemetry.fingerprint,
    messageId,
    lockedAt: now
  }));

  return { success: true, messageId };
    }
