'use client';

import React from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export default function ConfirmationDialog({ isOpen, onClose, onConfirm, title, description }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog Body */}
      <div className="relative w-full max-w-sm rounded border border-rose-900 bg-zinc-950 p-5 shadow-2xl text-xs font-mono select-none">
        
        {/* Warning Icon Banner */}
        <div className="flex items-center gap-2 text-rose-500 mb-3 font-semibold uppercase tracking-wider text-[11px]">
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>{title}</span>
        </div>
        
        <p className="text-zinc-400 mb-5 leading-normal font-sans">
          {description}
        </p>

        {/* Buttons Grid */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-bold cursor-pointer"
          >
            취소 (Cancel)
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3 py-1.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors font-bold cursor-pointer"
          >
            확인 (Confirm)
          </button>
        </div>

      </div>
    </div>
  );
}
