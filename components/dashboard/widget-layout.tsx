'use client';

import React, { useRef, useState, useEffect } from 'react';
import { DragState } from './hooks/use-dashboard-layout';
import { LayoutItem } from './workstation-dashboard-types';

interface WidgetLayoutProps {
  layout: LayoutItem[];
  activeDrag: DragState | null;
  placeholder: LayoutItem | null;
  startDrag: (id: string, startX: number, startY: number, initialLeft: number, initialTop: number) => void;
  updateDrag: (clientX: number, clientY: number, colWidth: number, rowHeight: number, gap: number, cols?: number) => void;
  endDrag: () => void;
  children: React.ReactNode;
  cols?: number;
  rowHeight?: number;
  gap?: number;
}

export function WidgetLayout({
  layout,
  activeDrag,
  placeholder,
  startDrag,
  updateDrag,
  endDrag,
  children,
  cols = 12,
  rowHeight = 80,
  gap = 24
}: WidgetLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Resize container observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
    };
  }, []);

  const colWidth = (containerWidth - (cols - 1) * gap) / cols;

  // Bind pointermove and pointerup event handlers on window level when activeDrag is present
  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateDrag(e.clientX, e.clientY, colWidth, rowHeight, gap, cols);
    };

    const handlePointerUp = () => {
      endDrag();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, colWidth, rowHeight, gap, cols, updateDrag, endDrag]);

  // Handle pointer down on widgets
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    const target = e.target as HTMLElement;
    // Check if clicked element or parent has .drag-handle class
    const isDragHandle = target.closest('.drag-handle');
    if (!isDragHandle) return;

    e.preventDefault();

    // Find widget element
    const widgetElement = target.closest('.grid-widget-wrapper') as HTMLElement;
    const containerElement = containerRef.current;
    if (!widgetElement || !containerElement) return;

    const rect = widgetElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    const initialLeft = rect.left - containerRect.left;
    const initialTop = rect.top - containerRect.top;

    // Capture pointer down coordinates
    startDrag(id, e.clientX, e.clientY, initialLeft, initialTop);
  };

  // Convert layout children to lookup map
  const childrenMap: Record<string, React.ReactNode> = {};
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.key) {
      childrenMap[child.key.toString()] = child;
    }
  });

  // Calculate container height based on bottom-most widget
  const maxRows = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const containerHeight = maxRows * (rowHeight + gap) - gap;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{
        height: `${Math.max(400, containerHeight)}px`,
        transition: 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
    >
      {/* Snap position placeholder helper card preview */}
      {placeholder && activeDrag && (
        <div
          className="absolute bg-primary/[0.04] border border-dashed border-primary/40 rounded-xl transition-all duration-150 ease-out z-10 pointer-events-none"
          style={{
            left: `${placeholder.x * (colWidth + gap)}px`,
            top: `${placeholder.y * (rowHeight + gap)}px`,
            width: `${placeholder.w * colWidth + (placeholder.w - 1) * gap}px`,
            height: `${placeholder.h * rowHeight + (placeholder.h - 1) * gap}px`
          }}
        />
      )}

      {/* Actual widget absolute positioning containers */}
      {layout.map((item) => {
        const child = childrenMap[item.id];
        if (!child) return null;

        const isDragging = activeDrag?.id === item.id;
        
        // Calculate dynamic dimensions
        const width = item.w * colWidth + (item.w - 1) * gap;
        const height = item.h * rowHeight + (item.h - 1) * gap;
        
        let left = item.x * (colWidth + gap);
        let top = item.y * (rowHeight + gap);

        if (isDragging && activeDrag) {
          left = activeDrag.currentLeft;
          top = activeDrag.currentTop;
        }

        return (
          <div
            key={item.id}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            className="grid-widget-wrapper absolute select-none"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `translate3d(${left}px, ${top}px, 0)`,
              zIndex: isDragging ? 40 : 20,
              // Smooth easing transition only when NOT actively dragging the element
              transition: isDragging
                ? 'none'
                : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.25s, height 0.25s',
              touchAction: 'none' // Prevent screen scrolls during touch drags
            }}
          >
            {/* Inject visual states for dragging inside children if needed */}
            <div className={`w-full h-full h-full flex flex-col ${
              isDragging ? 'opacity-85 scale-[1.01] rotate-[0.5deg] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-primary/30 rounded-xl transition-all duration-75' : ''
            }`}>
              {child}
            </div>
          </div>
        );
      })}
    </div>
  );
}
