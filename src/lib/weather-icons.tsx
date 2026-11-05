/**
 * Weather icons — detailed SVG pictograms for WMO weather codes.
 *
 * 2026-11-05: extracted from weather-screen.tsx (was local function codeIcon)
 * to share between /weather.php (hourly + daily forecast) and the home page
 * right column widget <HomeWeatherWidget />.
 *
 * Each icon is a self-contained SVG with gradients (radialGradient for sun,
 * linearGradient for clouds/drops). viewBox 0 0 64 64, width/height = 1em
 * (scales with font-size of container).
 *
 * Gradient IDs are NOT unique per instance — if the same code appears
 * multiple times on the page (e.g., 7 day cells with code=2), the browser
 * uses the first definition. Visually identical, so this is fine.
 */

import type { ReactNode } from "react";

export function codeIcon(code: number): ReactNode {
  // 0 = Ясно (clear sky) — объёмное солнце с лучами
  if (code === 0) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="wx-sun" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff3a0" />
            <stop offset="55%" stopColor="#ffc233" />
            <stop offset="100%" stopColor="#e88a00" />
          </radialGradient>
        </defs>
        <g stroke="#ffb300" strokeWidth="4" strokeLinecap="round" opacity="0.95">
          <line x1="32" y1="3" x2="32" y2="13" />
          <line x1="32" y1="51" x2="32" y2="61" />
          <line x1="3" y1="32" x2="13" y2="32" />
          <line x1="51" y1="32" x2="61" y2="32" />
          <line x1="11.5" y1="11.5" x2="18.5" y2="18.5" />
          <line x1="45.5" y1="45.5" x2="52.5" y2="52.5" />
          <line x1="52.5" y1="11.5" x2="45.5" y2="18.5" />
          <line x1="18.5" y1="45.5" x2="11.5" y2="52.5" />
        </g>
        <circle cx="32" cy="32" r="13" fill="url(#wx-sun)" stroke="#d97a00" strokeWidth="0.8" />
        <circle cx="27" cy="27" r="3.5" fill="#fff7c0" opacity="0.85" />
      </svg>
    );
  }
  // 1-2 = Переменная облачность (sun + cloud, объёмные)
  if (code <= 2) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="wx-sun2" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff3a0" />
            <stop offset="55%" stopColor="#ffc233" />
            <stop offset="100%" stopColor="#e88a00" />
          </radialGradient>
          <linearGradient id="wx-cloud2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e3eaf2" />
            <stop offset="100%" stopColor="#b8c5d3" />
          </linearGradient>
        </defs>
        <g stroke="#ffb300" strokeWidth="3" strokeLinecap="round" opacity="0.95">
          <line x1="22" y1="3" x2="22" y2="9" />
          <line x1="3" y1="22" x2="9" y2="22" />
          <line x1="8" y1="8" x2="12.5" y2="12.5" />
          <line x1="36" y1="8" x2="31.5" y2="12.5" />
          <line x1="8" y1="36" x2="12.5" y2="31.5" />
        </g>
        <circle cx="22" cy="22" r="10" fill="url(#wx-sun2)" stroke="#d97a00" strokeWidth="0.6" />
        <circle cx="18" cy="19" r="2.5" fill="#fff7c0" opacity="0.85" />
        <path d="M20 44 a11 11 0 0 1 11 -11 a13 13 0 0 1 13 11 a8 8 0 0 1 -1 16 H22 a8 8 0 0 1 -2 -16 z" fill="url(#wx-cloud2)" stroke="#8fa3b8" strokeWidth="0.8" />
        <path d="M22 44 a11 11 0 0 1 4 -8.5 a10 10 0 0 0 -4 8.5 a8 8 0 0 0 2 16 h-2 a8 8 0 0 1 -2 -16 z" fill="#ffffff" opacity="0.5" />
      </svg>
    );
  }
  // 3 = Облачно (объёмное облако)
  if (code === 3) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="wx-cloud3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8eef4" />
            <stop offset="60%" stopColor="#b6c4d2" />
            <stop offset="100%" stopColor="#7c8a9d" />
          </linearGradient>
        </defs>
        <path d="M18 42 a12 12 0 0 1 12 -12 a14 14 0 0 1 14 12 a9 9 0 0 1 -1 18 H19 a9 9 0 0 1 -1 -18 z" fill="url(#wx-cloud3)" stroke="#5a6b7d" strokeWidth="0.8" />
        <path d="M18 42 a12 12 0 0 1 5 -9 a11 11 0 0 0 -5 9 a9 9 0 0 0 2 18 h-2 a9 9 0 0 1 -1 -18 z" fill="#ffffff" opacity="0.4" />
      </svg>
    );
  }
  // 45/48 = Туман
  if (code === 45 || code === 48) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="wx-fog" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a8b8c8" />
          </linearGradient>
        </defs>
        <g stroke="url(#wx-fog)" strokeWidth="5" strokeLinecap="round" opacity="0.85">
          <line x1="8" y1="18" x2="56" y2="18" />
          <line x1="4" y1="32" x2="52" y2="32" />
          <line x1="12" y1="46" x2="60" y2="46" />
        </g>
      </svg>
    );
  }
  // 51-67, 80-82 = Дождь
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="wx-cloud4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d8e0e8" />
            <stop offset="60%" stopColor="#9aaabc" />
            <stop offset="100%" stopColor="#6a7888" />
          </linearGradient>
          <linearGradient id="wx-drop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7cc3f0" />
            <stop offset="100%" stopColor="#2a7ab8" />
          </linearGradient>
        </defs>
        <path d="M18 34 a12 12 0 0 1 12 -12 a14 14 0 0 1 14 12 a9 9 0 0 1 -1 18 H19 a9 9 0 0 1 -1 -18 z" fill="url(#wx-cloud4)" stroke="#4a5868" strokeWidth="0.8" />
        <g fill="url(#wx-drop)">
          <path d="M22 47 c-1.5 2 -2 4 -2 5 a3 3 0 0 0 6 0 c0 -1 -0.5 -3 -2 -5 a1 1 0 0 0 -2 0 z" />
          <path d="M32 47 c-1.5 2 -2 4 -2 5 a3 3 0 0 0 6 0 c0 -1 -0.5 -3 -2 -5 a1 1 0 0 0 -2 0 z" />
          <path d="M42 47 c-1.5 2 -2 4 -2 5 a3 3 0 0 0 6 0 c0 -1 -0.5 -3 -2 -5 a1 1 0 0 0 -2 0 z" />
        </g>
      </svg>
    );
  }
  // 71-77, 85, 86 = Снег
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="wx-cloud5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e3eaf2" />
            <stop offset="100%" stopColor="#b8c5d3" />
          </linearGradient>
        </defs>
        <path d="M18 34 a12 12 0 0 1 12 -12 a14 14 0 0 1 14 12 a9 9 0 0 1 -1 18 H19 a9 9 0 0 1 -1 -18 z" fill="url(#wx-cloud5)" stroke="#8fa3b8" strokeWidth="0.8" />
        <g fill="#5b9bd5" stroke="#2a6fa8" strokeWidth="0.6">
          <g transform="translate(22 50)">
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="2.1" x2="2.1" y2="-2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
          </g>
          <g transform="translate(32 54)">
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="2.1" x2="2.1" y2="-2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
          </g>
          <g transform="translate(42 50)">
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-2.1" y1="2.1" x2="2.1" y2="-2.1" stroke="#2a6fa8" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    );
  }
  // 95+ = Гроза
  if (code >= 95) {
    return (
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="wx-cloud6" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a8b4c4" />
            <stop offset="60%" stopColor="#5a6b7d" />
            <stop offset="100%" stopColor="#3a4654" />
          </linearGradient>
          <linearGradient id="wx-bolt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff3a0" />
            <stop offset="60%" stopColor="#ffc233" />
            <stop offset="100%" stopColor="#e88a00" />
          </linearGradient>
        </defs>
        <path d="M18 30 a12 12 0 0 1 12 -12 a14 14 0 0 1 14 12 a9 9 0 0 1 -1 18 H19 a9 9 0 0 1 -1 -18 z" fill="url(#wx-cloud6)" stroke="#2a3440" strokeWidth="0.8" />
        <path d="M32 32 l-7 14 h6 l-4 14 l14 -18 h-7 l5 -10 z" fill="url(#wx-bolt)" stroke="#d97a00" strokeWidth="0.6" />
      </svg>
    );
  }
  // default = перем. облачность (как 1-2)
  return (
    <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="wx-sun-def" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff3a0" />
          <stop offset="55%" stopColor="#ffc233" />
          <stop offset="100%" stopColor="#e88a00" />
        </radialGradient>
        <linearGradient id="wx-cloud-def" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e3eaf2" />
          <stop offset="100%" stopColor="#b8c5d3" />
        </linearGradient>
      </defs>
      <g stroke="#ffb300" strokeWidth="3" strokeLinecap="round" opacity="0.95">
        <line x1="22" y1="3" x2="22" y2="9" />
        <line x1="3" y1="22" x2="9" y2="22" />
        <line x1="8" y1="8" x2="12.5" y2="12.5" />
        <line x1="36" y1="8" x2="31.5" y2="12.5" />
        <line x1="8" y1="36" x2="12.5" y2="31.5" />
      </g>
      <circle cx="22" cy="22" r="10" fill="url(#wx-sun-def)" stroke="#d97a00" strokeWidth="0.6" />
      <circle cx="18" cy="19" r="2.5" fill="#fff7c0" opacity="0.85" />
      <path d="M20 44 a11 11 0 0 1 11 -11 a13 13 0 0 1 13 11 a8 8 0 0 1 -1 16 H22 a8 8 0 0 1 -2 -16 z" fill="url(#wx-cloud-def)" stroke="#8fa3b8" strokeWidth="0.8" />
      <path d="M22 44 a11 11 0 0 1 4 -8.5 a10 10 0 0 0 -4 8.5 a8 8 0 0 0 2 16 h-2 a8 8 0 0 1 -2 -16 z" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
