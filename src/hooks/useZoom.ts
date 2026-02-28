import { useState, useCallback } from "react";

const MIN_FONT = 10;
const MAX_FONT = 28;
const STEP = 2;
const DEFAULT_FONT = 14;

// Keep the same ratio as the original design: 14px font → 22px line height ≈ 1.571
const LINE_HEIGHT_RATIO = 22 / 14;

const calcLineHeight = (fontSize: number) =>
  Math.round(fontSize * LINE_HEIGHT_RATIO);

export function useZoom() {
  const [editorFontSize, setEditorFontSize] = useState<number>(DEFAULT_FONT);

  const editorLineHeight = calcLineHeight(editorFontSize);

  const zoomIn = useCallback(() => {
    setEditorFontSize((prev) => Math.min(prev + STEP, MAX_FONT));
  }, []);

  const zoomOut = useCallback(() => {
    setEditorFontSize((prev) => Math.max(prev - STEP, MIN_FONT));
  }, []);

  const resetZoom = useCallback(() => {
    setEditorFontSize(DEFAULT_FONT);
  }, []);

  return { editorFontSize, editorLineHeight, zoomIn, zoomOut, resetZoom };
}
