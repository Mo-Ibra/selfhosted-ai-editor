import { useState, useCallback } from "react";

export interface EditorSettings {
  autoCompletion: boolean;
  theme: 'catppuccin' | 'midnight' | 'monokai' | 'light';
  keyboardSound: boolean;
  // future settings go here...
}

const DEFAULT_SETTINGS: EditorSettings = {
  autoCompletion: true,
  theme: 'catppuccin',
  keyboardSound: false,
};


export function useSettings() {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(
    <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleSetting = useCallback((key: keyof EditorSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return { settings, updateSetting, toggleSetting };
}
