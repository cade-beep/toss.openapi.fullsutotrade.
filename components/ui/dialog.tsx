'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
      <div className="relative w-full max-w-sm rounded-xl border border-danger/20 bg-zinc-950 p-4 shadow-2xl text-xs font-mono select-none">
        
        {/* Warning Icon Banner */}
        <div className="flex items-center gap-2 text-danger mb-4 font-semibold uppercase tracking-wider text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{title}</span>
        </div>
        
        <p className="text-zinc-400 mb-4 leading-normal font-sans">
          {description}
        </p>

        {/* Buttons Grid */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-bold cursor-pointer"
          >
            취소 (Cancel)
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl bg-danger/15 hover:bg-danger/25 border border-danger/30 hover:border-danger/55 text-danger transition-colors font-bold cursor-pointer"
          >
            확인 (Confirm)
          </button>
        </div>

      </div>
    </div>
  );
}
