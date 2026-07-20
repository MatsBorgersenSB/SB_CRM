"use client";

import { useCallback, useEffect } from "react";

type CellPosition = { row: number; col: number };

type UseCellKeyboardOptions = {
  rowCount: number;
  colCount: number;
  position: CellPosition;
  onMove: (next: CellPosition) => void;
  onEnter?: () => void;
  disabled?: boolean;
};

export function useCellKeyboard({
  rowCount,
  colCount,
  position,
  onMove,
  onEnter,
  disabled = false,
}: UseCellKeyboardOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      let next: CellPosition | null = null;

      switch (event.key) {
        case "ArrowUp":
          next = { row: Math.max(0, position.row - 1), col: position.col };
          break;
        case "ArrowDown":
          next = {
            row: Math.min(rowCount - 1, position.row + 1),
            col: position.col,
          };
          break;
        case "ArrowLeft":
          next = { row: position.row, col: Math.max(0, position.col - 1) };
          break;
        case "ArrowRight":
          next = {
            row: position.row,
            col: Math.min(colCount - 1, position.col + 1),
          };
          break;
        case "Enter":
          event.preventDefault();
          onEnter?.();
          return;
        default:
          return;
      }

      if (next) {
        event.preventDefault();
        onMove(next);
      }
    },
    [colCount, disabled, onEnter, onMove, position.col, position.row, rowCount],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
