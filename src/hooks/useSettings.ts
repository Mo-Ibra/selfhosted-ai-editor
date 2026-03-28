import { useState, useCallback } from "react";

export interface EditorSettings {
  autoCompletion: boolean;
  theme: 'catppuccin' | 'midnight' | 'monokai' | 'light';
  keyboardSound: boolean;
  aiModel: string;
  // future settings go here...
}

const DEFAULT_SETTINGS: EditorSettings = {
  autoCompletion: true,
  theme: 'catppuccin',
  keyboardSound: false,
  aiModel: 'gpt-oss:120b-cloud',
};


const SETTINGS_KEY = 'ai-editor-settings';

export function useSettings() {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If the saved model is the old default or empty, use the new default
        if (parsed.aiModel === 'gpt-3.5-turbo' || !parsed.aiModel) {
          parsed.aiModel = DEFAULT_SETTINGS.aiModel;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }));
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSetting = useCallback(
    <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const toggleSetting = useCallback((key: keyof EditorSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSetting, toggleSetting };
}
