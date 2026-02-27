import { useEffect, useRef } from 'react'
import { Monaco } from '@monaco-editor/react'
import { AIEdit } from '../types'
import { getLanguage } from "../utils/language";

// ─── File Models Hook ─────────────────────────────────────────────────────────
// Keeps Monaco models in sync with the loaded project files so that
// TypeScript worker can resolve imports (Ctrl+Click, errors, autocomplete).

/**
 * Syncs Monaco editor models with the loaded project files.
 * 
 * This hook is used to create and update Monaco editor models for each file in the project.
 * This allows the TypeScript worker to resolve imports and provide autocompletion.
 * 
 * Why this is required:
 * Monaco does NOT automatically know about your project files.
 * Each file must have a registered model for:
 *   • TypeScript import resolution
 *   • Cross-file IntelliSense
 *   • Jump-to-definition
 *   • Error diagnostics
 * 
 * @param monacoRef - Reference to the Monaco instance.
 * @param fileContents - Object containing file paths and their contents.
 * @param filePath - The path to the currently active file.
 */
export function useFileModels(
  // Monaco instance
  monacoRef: React.MutableRefObject<Monaco | null>,
  // All loaded files
  fileContents: Record<string, string>,
  // Current file path
  filePath: string | null,
) {

  useEffect(() => {

    const monaco = monacoRef.current;

    // If no monaco instance, return
    if (!monaco) return;

    // Get the active URI (replace backslashes with forward slashes to make it compatible with Monaco)
    const activeUri = filePath?.replace(/\\/g, '/');

    // Create or update a model for every loaded project file
    Object.entries(fileContents).forEach(([absPath, content]) => {
      const uriStr = absPath.replace(/\\/g, '/');
      if (uriStr === activeUri) return; // MonacoEditor manages the active file

      // Create a URI for the file
      const uri = monaco.Uri.parse(uriStr);
      // Get the existing model for the file
      const existing = monaco.editor.getModel(uri);

      // If the model exists, update it if the content has changed
      if (existing) {
        if (existing.getValue() !== content) existing.setValue(content)
      } else {
        // Otherwise, create a new model
        try {
          monaco.editor.createModel(content, getLanguage(absPath), uri)
        } catch (e) {
          console.warn('Failed to create model for', absPath, e)
        }
      }
    });

    // Dispose models for files no longer in fileContents
    monaco.editor.getModels().forEach((model: any) => {
      const uriStr = model.uri.toString()
      if (uriStr === activeUri) return
      const stillLoaded = Object.keys(fileContents).some(
        (p) => p.replace(/\\/g, '/') === uriStr,
      )
      if (!stillLoaded) model.dispose()
    });

  }, [fileContents, filePath, monacoRef])

};