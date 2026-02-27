import { useRef } from 'react'
import { Monaco } from '@monaco-editor/react'

const STANDARD_LIBS = [
  {
    filePath: 'electron.d.ts',
    content: `declare module 'electron' {
      export const app: any;
      export const BrowserWindow: any;
      export const ipcMain: any;
      export const dialog: any;
      export const shell: any;
    }`,
  },
  {
    filePath: 'node-env.d.ts',
    content: `
      declare module 'node:fs' { export * from 'fs'; }
      declare module 'fs' {
        export function readFileSync(path: string, options?: any): string;
        export function writeFileSync(path: string, data: string, options?: any): void;
        export function existsSync(path: string): boolean;
        export function mkdirSync(path: string, options?: any): void;
        export function readdirSync(path: string, options?: any): any[];
      }
      declare module 'node:path' { export * from 'path'; }
      declare module 'path' {
        export function join(...paths: string[]): string;
        export function dirname(p: string): string;
        export function basename(p: string): string;
        export function extname(p: string): string;
        export function resolve(...paths: string[]): string;
      }
      declare module 'node:url' {
        export function fileURLToPath(url: string | URL): string;
        export function pathToFileURL(path: string): URL;
      }
      declare module 'node:module' {
        export function createRequire(path: string | URL): any;
      }
    `,
  },
  {
    filePath: 'react-env.d.ts',
    content: `declare module 'react' {
      export const useState: any;
      export const useEffect: any;
      export const useRef: any;
      export const useCallback: any;
      export const useMemo: any;
      export const useContext: any;
      export const createContext: any;
      export const memo: any;
      export const forwardRef: any;
      export const Fragment: any;
      export default { useState, useEffect, useRef, useCallback, useMemo };
    }
    declare module 'react/jsx-runtime' {
      export const jsx: any;
      export const jsxs: any;
      export const Fragment: any;
    }`,
  },
  {
    filePath: 'third-party-stubs.d.ts',
    content: `
      declare module 'lucide-react' {
        import { FC, SVGProps } from 'react';
        export type LucideIcon = FC<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string; }>;
        export const [key: string]: LucideIcon;
      }
      declare module 'next/link' { const Link: any; export default Link; }
      declare module 'next/image' { const Image: any; export default Image; }
      declare module 'next/navigation' {
        export const useRouter: any;
        export const usePathname: any;
        export const useSearchParams: any;
        export const redirect: any;
      }
      declare module 'next/server' { export const NextResponse: any; export const NextRequest: any; }
      declare module 'next/font/google' { export const [key: string]: any; }
      declare module 'next/headers' { export const cookies: any; export const headers: any; }
      declare module 'clsx' { const clsx: (...args: any[]) => string; export default clsx; export { clsx }; }
      declare module 'tailwind-merge' { export const twMerge: (...args: any[]) => string; }
      declare module 'class-variance-authority' { export const cva: any; export type VariantProps<T> = any; }
      declare module '*' { const value: any; export default value; export = value; }
    `,
  },
]

function injectDiffStyles() {
  const styleId = 'monaco-diff-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .diff-removed-line {
      background: rgba(243, 139, 168, 0.15) !important;
      text-decoration: line-through;
      opacity: 0.8;
    }
    .diff-added-block {
      display: block;
      background: rgba(166, 227, 161, 0.1) !important;
      color: #a6e3a1;
      white-space: pre;
      margin-top: 2px;
      padding: 2px 8px;
      border-left: 2px solid #a6e3a1;
      font-family: inherit;
      font-size: 0.95em;
    }
    .diff-gutter-removed { border-left: 2px solid #f38ba8; }
  `
  document.head.appendChild(style)
}

export function useMonacoSetup(folderPathRef: React.MutableRefObject<string | null>) {
  const monacoRef = useRef<Monaco | null>(null);

  function configureMonaco(monaco: Monaco) {
    monacoRef.current = monaco;

    monaco.editor.defineTheme('standard-jsx', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'tag', foreground: 'f38ba8' },
        { token: 'tag.identifier', foreground: 'f38ba8' },
        { token: 'tag.attribute.name', foreground: 'fab387' },
        { token: 'delimiter.html', foreground: '94e2d5' },
        { token: 'delimiter.xml', foreground: '94e2d5' },
      ],
      colors: {},
    });

    monaco.editor.setTheme('standard-jsx');

    const root = folderPathRef.current?.replace(/\\/g, '/') ?? ''
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      esModuleInterop: true,
      baseUrl: root || 'file:///',
      paths: { '@/*': [`${root}/src/*`] },
      typeRoots: ['node_modules/@types'],
    });

    STANDARD_LIBS.forEach(({ filePath, content }) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(content, `file:///${filePath}`)
    })

    injectDiffStyles()
  }

  return { monacoRef, configureMonaco }
}