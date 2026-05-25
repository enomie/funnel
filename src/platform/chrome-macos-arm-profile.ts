// Path: /Users/johann/MyBrew/funnel-real/src/platform/chrome-macos-arm-profile.ts



export const PLATFORM_TARGET_NOTE =
  'Optimized for macOS + M1 and latest Chrome browser';

const PLATFORM_APPLE_ICON = '/icons/platform-apple.svg';
const PLATFORM_CHROME_ICON = '/icons/platform-chrome.svg';


export function renderPlatformTargetNoteHtml(): string {
  return `
    <span class="funnel-prematch-screen__platform-note-part">Optimized for</span>
    <span class="funnel-prematch-screen__platform-chip">
      <img class="funnel-prematch-screen__platform-icon" src="${PLATFORM_APPLE_ICON}" width="12" height="12" alt="" aria-hidden="true">
      <span>macOS M1+ </span>
    </span>
    <span class="funnel-prematch-screen__platform-note-part"> </span>
    <span class="funnel-prematch-screen__platform-chip">
      <img class="funnel-prematch-screen__platform-icon" src="${PLATFORM_CHROME_ICON}" width="12" height="12" alt="" aria-hidden="true">
      <span>Chrome browser</span>
    </span>
  `.trim();
}

export interface RuntimePlatformProfile {
  readonly isTarget: boolean;
  readonly pixelRatioCap: number;
  readonly shadowMapSize: number;
  readonly shadowsEnabled: boolean;
  readonly navRayBudgetPerFrame: number;
  
  readonly routeSteerFanBudgetPerFrame: number;
  readonly shadowSubjectsPerFrame: number;
  readonly rendererAntialias: boolean;
  readonly rendererSamples: number;
  readonly pointerLockUnadjustedMovement: boolean;
  
  readonly playersPerTeam: number;
  
  readonly maxRenderHz: number;
  readonly physicsMaxSubSteps: number;
  readonly botBrainTickHz: number;
  
  readonly rainWaveCountScale: number;
  
  readonly rainDropIntervalScale: number;
}

interface NavigatorUaDataBrand {
  readonly brand: string;
}

interface NavigatorUaData {
  readonly platform?: string;
  readonly brands?: readonly NavigatorUaDataBrand[];
}


const TARGET_PROFILE: RuntimePlatformProfile = {
  isTarget: true,
  pixelRatioCap: 1,
  shadowMapSize: 512,
  shadowsEnabled: false,
  navRayBudgetPerFrame: 3,
  routeSteerFanBudgetPerFrame: 10,
  shadowSubjectsPerFrame: 8,
  rendererAntialias: false,
  rendererSamples: 0,
  pointerLockUnadjustedMovement: true,
  playersPerTeam: 15,
  maxRenderHz: 60,
  physicsMaxSubSteps: 3,
  botBrainTickHz: 2,
  rainWaveCountScale: 0.35,
  rainDropIntervalScale: 2
};

const FALLBACK_PROFILE: RuntimePlatformProfile = {
  isTarget: false,
  pixelRatioCap: 2,
  shadowMapSize: 512,
  shadowsEnabled: true,
  navRayBudgetPerFrame: 4,
  routeSteerFanBudgetPerFrame: 16,
  shadowSubjectsPerFrame: 12,
  rendererAntialias: true,
  rendererSamples: 4,
  pointerLockUnadjustedMovement: false,
  playersPerTeam: 15,
  maxRenderHz: 0,
  physicsMaxSubSteps: 6,
  botBrainTickHz: 6,
  rainWaveCountScale: 1,
  rainDropIntervalScale: 1
};

let runtimeProfile: RuntimePlatformProfile | null = null;

function readNavigatorUaData(): NavigatorUaData | undefined {
  return (navigator as Navigator & { userAgentData?: NavigatorUaData }).userAgentData;
}

function isGoogleChrome(): boolean {
  const uaData = readNavigatorUaData();
  const brands = uaData?.brands;
  if (brands !== undefined) {
    return brands.some((entry) => entry.brand === 'Google Chrome');
  }

  const userAgent = navigator.userAgent;
  return /\bChrome\//.test(userAgent) && !/\b(Edg|OPR|Brave)\//.test(userAgent);
}

function isMacOS(): boolean {
  if (readNavigatorUaData()?.platform === 'macOS') {
    return true;
  }

  return /Mac/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent);
}


function probeAppleSiliconGpu(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl', { powerPreference: 'high-performance' }) ??
      canvas.getContext('experimental-webgl');
    if (!(gl instanceof WebGLRenderingContext)) {
      return false;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo === null) {
      return false;
    }

    const renderer: unknown = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && /Apple M[1-9]\d*/i.test(renderer);
  } catch {
    return false;
  }
}

function detectRuntimeProfile(): RuntimePlatformProfile {
  if (isGoogleChrome() && isMacOS() && probeAppleSiliconGpu()) {
    return TARGET_PROFILE;
  }

  return FALLBACK_PROFILE;
}

function applyDocumentProfile(profile: RuntimePlatformProfile): void {
  const root = document.documentElement;
  root.dataset.funnelPlatform = profile.isTarget ? 'chrome-macos-arm' : 'generic';
  root.classList.toggle('funnel-platform-target', profile.isTarget);
}


export function initRuntimeProfile(): RuntimePlatformProfile {
  if (runtimeProfile !== null) {
    return runtimeProfile;
  }

  runtimeProfile = detectRuntimeProfile();
  applyDocumentProfile(runtimeProfile);
  return runtimeProfile;
}

export function getRuntimeProfile(): RuntimePlatformProfile {
  return runtimeProfile ?? initRuntimeProfile();
}

export function getRendererPixelRatio(): number {
  const { pixelRatioCap } = getRuntimeProfile();
  return Math.min(window.devicePixelRatio, pixelRatioCap);
}


export function shouldAdvanceGameFrame(nowMs: number, lastTickMs: number): boolean {
  if (document.visibilityState === 'hidden') {
    return false;
  }

  const { maxRenderHz } = getRuntimeProfile();
  if (maxRenderHz <= 0) {
    return true;
  }

  return nowMs - lastTickMs >= 1000 / maxRenderHz - 0.25;
}
