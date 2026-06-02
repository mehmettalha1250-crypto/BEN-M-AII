/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoProps {
  variant?: 'square' | 'circle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export default function Logo({
  variant = 'circle',
  size = 'md',
  className = '',
  showText = false
}: LogoProps) {
  // Sizing mapping
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24'
  };

  const containerShape = variant === 'square' 
    ? 'rounded-none border-white/10' 
    : 'rounded-full border-cyan-500/30';

  return (
    <div className={`flex items-center gap-3 ${className}`} id="benimai_logo_container">
      {/* Immersive Cybernetic Moon Logo */}
      <div className={`${sizeClasses[size]} ${containerShape} bg-gradient-to-tr from-cyan-950/40 to-blue-900/10 border flex items-center justify-center relative shadow-lg shadow-cyan-950/40 shrink-0 overflow-hidden group`}>
        {/* Subtle background tech scanning animation */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent -translate-y-full group-hover:animate-[scan_2s_infinite] pointer-events-none" />
        
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
        >
          {/* Cyber Crescent Moon */}
          <path
            d="M75,25 C50,25 35,45 35,65 C35,80 48,93 65,93 C50,93 25,80 25,55 C25,30 50,15 75,25 Z"
            fill="url(#moon-grad)"
            stroke="#22d3ee"
            strokeWidth="1.5"
          />

          {/* Connected Network Nodes inside Moon */}
          <circle cx="42" cy="45" r="2.5" fill="#22d3ee" className="animate-pulse" />
          <circle cx="50" cy="35" r="2" fill="#22d3ee" />
          <circle cx="37" cy="60" r="2.5" fill="#22d3ee" />
          <circle cx="45" cy="72" r="2" fill="#38bdf8" />
          <circle cx="58" cy="80" r="2.5" fill="#22d3ee" className="animate-pulse" />

          {/* Constellation line connections */}
          <line x1="42" y1="45" x2="50" y2="35" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="1 1" />
          <line x1="42" y1="45" x2="37" y2="60" stroke="#22d3ee" strokeWidth="0.5" />
          <line x1="37" y1="60" x2="45" y2="72" stroke="#22d3ee" strokeWidth="0.5" />
          <line x1="45" y1="72" x2="58" y2="80" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="1 1" />

          {/* Futuristic 'AY' Center Branding Label */}
          <text 
            x="56" 
            y="61" 
            fill="#ffffff" 
            fontFamily="monospace" 
            fontWeight="900" 
            fontSize="21" 
            letterSpacing="-1" 
            className="select-none tracking-tighter"
            fontStyle="italic"
          >
            AY
          </text>

          {/* Gradient declarations */}
          <defs>
            <linearGradient id="moon-grad" x1="25" y1="15" x2="75" y2="93" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0891b2" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-sm font-black text-white italic tracking-tighter uppercase font-sans">
              BENİM AI
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
