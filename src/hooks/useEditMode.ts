/**
 * Hook to manage edit mode with hover
 * Allows selecting elements by hovering and modifying them
 */

import { useState, useCallback } from 'react';

export interface SelectedElement {
  type: string;
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

export function useEditMode() {
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [hoveredElement, setHoveredElement] = useState<SelectedElement | null>(null);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => {
      if (prev) {
        // When leaving edit mode, deselect everything
        setSelectedElement(null);
        setHoveredElement(null);
      }
      return !prev;
    });
  }, []);

  const selectElement = useCallback((element: SelectedElement | null) => {
    setSelectedElement(element);
  }, []);

  const hoverElement = useCallback((element: SelectedElement | null) => {
    if (editMode) {
      setHoveredElement(element);
    }
  }, [editMode]);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setHoveredElement(null);
  }, []);

  return {
    editMode,
    toggleEditMode,
    selectedElement,
    hoveredElement,
    selectElement,
    hoverElement,
    clearSelection,
  };
}
