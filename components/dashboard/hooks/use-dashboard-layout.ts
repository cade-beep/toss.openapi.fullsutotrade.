'use client';

import { useState, useCallback } from 'react';
import { LayoutItem } from '../workstation-dashboard-types';

const STORAGE_KEY = 'toss-workstation-dashboard-layout-v5';

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'rankings', x: 0, y: 0, w: 2, h: 9 },
  { id: 'chart', x: 2, y: 0, w: 6, h: 6 },
  { id: 'aiEngine', x: 2, y: 6, w: 6, h: 3 },
  { id: 'orderTicket', x: 8, y: 0, w: 2, h: 5 },
  { id: 'positions', x: 8, y: 5, w: 2, h: 4 }
];

export interface DragState {
  id: string;
  startX: number; // Pointer down clientX
  startY: number; // Pointer down clientY
  initialLeft: number; // Initial position left in px
  initialTop: number; // Initial position top in px
  currentLeft: number; // Current position left in px
  currentTop: number; // Current position top in px
}

// Bounding box collision check
export const collides = (a: LayoutItem, b: LayoutItem): boolean => {
  if (a.id === b.id) return false;
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
};

// Compact layout elements upwards to close gaps
export function compactLayout(layout: LayoutItem[], ignoreId?: string): LayoutItem[] {
  const sorted = [...layout]
    .map((item) => ({ ...item }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const compacted: LayoutItem[] = [];

  for (const item of sorted) {
    if (item.id === ignoreId) {
      compacted.push(item);
      continue;
    }
    while (item.y > 0) {
      const nextY = item.y - 1;
      const testItem = { ...item, y: nextY };
      let hasCollision = false;
      for (const comp of compacted) {
        if (collides(testItem, comp)) {
          hasCollision = true;
          break;
        }
      }
      if (hasCollision) {
        break;
      }
      item.y = nextY;
    }
    compacted.push(item);
  }

  return compacted;
}

// Reflow algorithm that shifts overlapping widgets down
export function reflowLayout(
  layout: LayoutItem[],
  dragItem: LayoutItem,
  cols: number = 10
): LayoutItem[] {
  // Constrain coordinates within column boundary
  const dragX = Math.max(0, Math.min(cols - dragItem.w, dragItem.x));
  const dragY = Math.max(0, dragItem.y);
  const fixedItem = { ...dragItem, x: dragX, y: dragY };

  const resolved: LayoutItem[] = [fixedItem];
  const others = layout
    .filter((item) => item.id !== dragItem.id)
    .map((item) => ({ ...item }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const item of others) {
    let colliding = true;
    while (colliding) {
      colliding = false;
      for (const res of resolved) {
        if (collides(item, res)) {
          item.y = res.y + res.h;
          colliding = true;
        }
      }
    }
    resolved.push(item);
  }

  return compactLayout(resolved, dragItem.id);
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as LayoutItem[];
          // Sanity checks on parsed elements
          if (Array.isArray(parsed) && parsed.length === DEFAULT_LAYOUT.length) {
            return compactLayout(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load dashboard layout', e);
      }
    }
    return compactLayout(DEFAULT_LAYOUT);
  });
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [placeholder, setPlaceholder] = useState<LayoutItem | null>(null);

  // Persist to localStorage
  const saveLayout = useCallback((newLayout: LayoutItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
    } catch (e) {
      console.error('Failed to save layout', e);
    }
  }, []);

  // Initiate drag operation
  const startDrag = useCallback((id: string, startX: number, startY: number, initialLeft: number, initialTop: number) => {
    setActiveDrag({
      id,
      startX,
      startY,
      initialLeft,
      initialTop,
      currentLeft: initialLeft,
      currentTop: initialTop
    });

    const item = layout.find((l) => l.id === id);
    if (item) {
      setPlaceholder({ ...item });
    }
  }, [layout]);

  // Update position coordinates on drag move
  const updateDrag = useCallback((clientX: number, clientY: number, colWidth: number, rowHeight: number, gap: number, cols: number = 10) => {
    if (!activeDrag) return;

    const dx = clientX - activeDrag.startX;
    const dy = clientY - activeDrag.startY;

    const currentLeft = activeDrag.initialLeft + dx;
    const currentTop = activeDrag.initialTop + dy;

    setActiveDrag((prev) => prev ? { ...prev, currentLeft, currentTop } : null);

    const item = layout.find((l) => l.id === activeDrag.id);
    if (!item) return;

    // Determine grid coordinates based on pointer coordinates
    const gridX = Math.max(0, Math.min(cols - item.w, Math.round(currentLeft / (colWidth + gap))));
    const gridY = Math.max(0, Math.round(currentTop / (rowHeight + gap)));

    const nextPlaceholder: LayoutItem = {
      id: activeDrag.id,
      x: gridX,
      y: gridY,
      w: item.w,
      h: item.h
    };

    setPlaceholder(nextPlaceholder);

    // Apply real-time reflow math on temporary layout
    const nextLayout = reflowLayout(layout, nextPlaceholder, cols);
    setLayout(nextLayout);
  }, [activeDrag, layout]);

  // Release drag state and finalize coordinates
  const endDrag = useCallback(() => {
    if (!activeDrag) return;

    // Compact final coordinates and save
    const finalized = compactLayout(layout);
    setLayout(finalized);
    saveLayout(finalized);

    setActiveDrag(null);
    setPlaceholder(null);
  }, [activeDrag, layout, saveLayout]);

  const resetLayout = useCallback(() => {
    const compacted = compactLayout(DEFAULT_LAYOUT);
    setLayout(compacted);
    saveLayout(compacted);
    setActiveDrag(null);
    setPlaceholder(null);
  }, [saveLayout]);

  return {
    layout,
    activeDrag,
    placeholder,
    startDrag,
    updateDrag,
    endDrag,
    resetLayout
  };
}
