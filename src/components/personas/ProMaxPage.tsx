import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderPlus, 
  File, 
  FilePlus, 
  Upload, 
  Play, 
  Terminal as TerminalIcon, 
  ArrowLeft, 
  Code, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Image, 
  Download, 
  Brain, 
  Send, 
  Check, 
  AlertCircle, 
  Monitor, 
  Smartphone, 
  Tablet,
  ChevronRight,
  ChevronDown,
  Layout,
  ExternalLink
} from 'lucide-react';
import { generateAIResponseStreaming } from '../../services/ai/aiProxyService';
import { useAuth } from '../../context/AuthContext';

// Default templates
const TEMPLATES = {
  react: {
    '/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TimeMachine PRO MAX App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Outfit', sans-serif;
        background-color: #0c0d12;
        color: #f3f4f6;
        margin: 0;
        overflow-x: hidden;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
    '/src/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}`,
    '/src/App.tsx': `import React, { useState } from 'react';
import { Sparkles, Code, Terminal, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  const [count, setCount] = useState(0);

  const triggerConfetti = () => {
    setCount(count + 1);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22d3ee', '#818cf8', '#ec4899']
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="relative p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-purple-500/10 -z-10" />
        
        <div className="flex justify-center gap-4 mb-6">
          <Code className="w-12 h-12 text-cyan-400 animate-pulse" />
          <Sparkles className="w-12 h-12 text-purple-400 animate-bounce" />
        </div>

        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          PRO MAX Space
        </h1>
        <p className="text-gray-400 mb-6 text-sm">
          Your isolated web developer workspace. Chat with PRO MAX on the left to edit files and compile!
        </p>

        <div className="bg-black/30 rounded-2xl p-4 mb-6 font-mono text-xs text-left border border-white/5">
          <div className="text-cyan-400">$ system_status</div>
          <div className="text-gray-300">Status: Running</div>
          <div className="text-gray-300">Sandbox: Active</div>
          <div className="text-gray-300">Interactions: {count}</div>
        </div>

        <button
          onClick={triggerConfetti}
          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-semibold transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Celebrate Actions
        </button>
      </div>
    </div>
  );
}`,
    '/src/styles.css': `/* Custom CSS rules go here */`
  },
  threejs: {
    '/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PRO MAX ThreeJS Space</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Outfit', sans-serif;
        background-color: #020205;
        color: #f3f4f6;
        margin: 0;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
    '/src/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}`,
    '/src/App.tsx': `import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Star } from 'lucide-react';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(0.01);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.015);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Geometry & Material (Torus)
    const geometry = new THREE.TorusGeometry(1.5, 0.4, 16, 100);
    const material = new THREE.MeshNormalMaterial({ wireframe: true });
    const torus = new THREE.Mesh(geometry, material);
    scene.add(torus);

    // Particles
    const particlesGeo = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 15;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x22d3ee
    });
    const particlesMesh = new THREE.Points(particlesGeo, particlesMaterial);
    scene.add(particlesMesh);

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      torus.rotation.x += speed;
      torus.rotation.y += speed * 1.5;
      particlesMesh.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      particlesGeo.dispose();
      particlesMaterial.dispose();
    };
  }, [speed]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="absolute inset-0 w-full h-full -z-10" />
      
      <div className="absolute top-8 left-8 p-6 rounded-2xl bg-black/45 border border-white/10 backdrop-blur-md max-w-sm">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2 text-white">
          <Star className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> ThreeJS Space
        </h1>
        <p className="text-gray-400 text-xs mb-4">
          WebGL rendering in-browser sandbox. Adjust compile speed:
        </p>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs text-cyan-400 font-semibold">Speed: {speed.toFixed(3)}</label>
          <input 
            type="range" 
            min="0.001" 
            max="0.05" 
            step="0.001"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-1 bg-cyan-950 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}`,
    '/src/styles.css': ''
  }
};

interface VFSFile {
  content: string;
  isBinary: boolean;
  mimeType?: string;
}

type VFS = Record<string, VFSFile>;

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: Record<string, TreeNode>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  statusLogs?: string[];
}

export function ProMaxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Virtual Filesystem State
  const [vfs, setVfs] = useState<VFS>(() => {
    const saved = localStorage.getItem('timeMachine_promax_vfs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to restore VFS', e);
      }
    }
    // Load initial react template
    return Object.fromEntries(
      Object.entries(TEMPLATES.react).map(([k, v]) => [k, { content: v, isBinary: false }])
    );
  });

  // Editor States
  const [activeFilePath, setActiveFilePath] = useState<string>('/src/App.tsx');
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorSaveStatus, setEditorSaveStatus] = useState<string>('Saved');

  // IDE Layout Tab: 'code' | 'preview' | 'terminal'
  const [activeTab, setActiveTab] = useState<'code' | 'preview' | 'terminal'>('code');
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

  // Compiler States
  const [babelLoaded, setBabelLoaded] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Welcome to TimeMachine PRO MAX Terminal Console v1.0.0',
    'Initializing compiler engine...'
  ]);

  // Chat/Agent States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedReasoning, setStreamedReasoning] = useState('');
  const [streamedContent, setStreamedContent] = useState('');
  const [systemActivity, setSystemActivity] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync VFS to localStorage on change
  useEffect(() => {
    localStorage.setItem('timeMachine_promax_vfs', JSON.stringify(vfs));
  }, [vfs]);

  // Sync editor field to active file
  useEffect(() => {
    if (vfs[activeFilePath]) {
      setEditorContent(vfs[activeFilePath].content);
      setEditorSaveStatus('Saved');
    }
  }, [activeFilePath, vfs]);

  // Load Babel Standalone
  useEffect(() => {
    if ((window as any).Babel) {
      setBabelLoaded(true);
      setTerminalLogs(prev => [...prev, '✓ Compiler engine initialized successfully.']);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@babel/standalone@7.24.0/babel.min.js';
    script.onload = () => {
      setBabelLoaded(true);
      setTerminalLogs(prev => [...prev, '✓ Compiler engine initialized successfully.']);
    };
    script.onerror = () => {
      setTerminalLogs(prev => [...prev, '❌ Failed to load compilation engine. Offline?']);
    };
    document.head.appendChild(script);
  }, []);

  // Intercept Iframe logs and compile-state updates
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_LOG') {
        const { level, message } = event.data;
        const timestamp = new Date().toLocaleTimeString();
        let prefix = '🟢 [LOG]';
        if (level === 'error') prefix = '🔴 [ERR]';
        if (level === 'warn') prefix = '🟡 [WRN]';
        setTerminalLogs(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  // Resolve VFS paths
  const resolveRelativePath = (importerPath: string, importeePath: string): string => {
    if (!importeePath.startsWith('.')) return importeePath;
    const importerSegments = importerPath.split('/').filter(Boolean);
    importerSegments.pop(); // Remove filename
    
    const importeeSegments = importeePath.split('/').filter(Boolean);
    for (const segment of importeeSegments) {
      if (segment === '.') continue;
      if (segment === '..') {
        importerSegments.pop();
      } else {
        importerSegments.push(segment);
      }
    }
    return '/' + importerSegments.join('/');
  };

  // Rewrite relative imports to absolute VFS paths in code
  const rewriteRelativeImports = (code: string, importerPath: string, vfsKeys: string[]): string => {
    return code.replace(/(from\s+['"]|import\s+['"]|import\s*\(\s*['"])([^'"]+)(['"])/g, (match, prefix, importee, suffix) => {
      if (!importee.startsWith('.')) return match;
      
      let resolved = resolveRelativePath(importerPath, importee);
      // Try adding extensions to locate the exact VFS key
      const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.css'];
      for (const ext of extensions) {
        if (vfsKeys.includes(resolved + ext)) {
          resolved = resolved + ext;
          break;
        }
      }
      return `${prefix}${resolved}${suffix}`;
    });
  };

  // Compiler engine: bundles TSX/JSX, injects imports map & HTML links, mounts frame
  const compileVFS = useCallback(async (currentVfs: VFS) => {
    if (!babelLoaded || !(window as any).Babel) {
      setTerminalLogs(prev => [...prev, '⚠️ Cannot compile: compiler engine is still loading...']);
      return;
    }

    setTerminalLogs(prev => [...prev, '⚙️ Compiling and bundling workspace...']);
    setIsCompiling(true);
    setErrorMessage(null);

    try {
      const blobUrls: Record<string, string> = {};
      const assetBlobUrls: Record<string, string> = {};

      // 1. Resolve assets (binary files) to blob URLs
      for (const [path, file] of Object.entries(currentVfs)) {
        if (file.isBinary) {
          try {
            const res = await fetch(file.content);
            const blob = await res.blob();
            assetBlobUrls[path] = URL.createObjectURL(blob);
          } catch (e) {
            assetBlobUrls[path] = file.content;
          }
        }
      }

      // 2. Compile TSX/JS files
      const compiledFiles: Record<string, string> = {};
      const vfsKeys = Object.keys(currentVfs);

      for (const [path, file] of Object.entries(currentVfs)) {
        if (file.isBinary) continue;
        if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) {
          let code = file.content;
          
          // Rewrite relative imports to absolute VFS targets
          code = rewriteRelativeImports(code, path, vfsKeys);

          // Strip CSS imports (CSS is injected directly in HTML head)
          code = code.replace(/import\s+['"][^'"]+\.css['"]\s*;?/g, '');

          try {
            const result = (window as any).Babel.transform(code, {
              filename: path,
              presets: ['react', 'typescript']
            });
            compiledFiles[path] = result.code || '';
          } catch (err: any) {
            throw new Error(`Compiler error in ${path}: ${err.message}`);
          }
        }
      }

      // 3. Create blob URLs for compiled modules and build the Native Import Map
      const importMapImports: Record<string, string> = {
        "react": "https://esm.sh/react@18.3.1",
        "react-dom": "https://esm.sh/react-dom@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
        "lucide-react": "https://esm.sh/lucide-react@0.344.0?external=react,react-dom",
        "framer-motion": "https://esm.sh/framer-motion@11.0.8?external=react,react-dom",
        "canvas-confetti": "https://esm.sh/canvas-confetti@1.9.3",
        "recharts": "https://esm.sh/recharts@2.12.0?external=react,react-dom"
      };

      for (const [path, compiledCode] of Object.entries(compiledFiles)) {
        // Rewrite asset path variables in JS back to resolved Blob URLs
        let finalCode = compiledCode;
        for (const [assetPath, blobUrl] of Object.entries(assetBlobUrls)) {
          const escaped = assetPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`['"]\\.?${escaped}['"]`, 'g');
          finalCode = finalCode.replace(regex, `"${blobUrl}"`);
        }

        const blob = new Blob([finalCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrls[path] = blobUrl;

        // Map both absolute and extensionless keys
        importMapImports[path] = blobUrl;
        if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
          importMapImports[path.slice(0, -4)] = blobUrl;
        } else if (path.endsWith('.ts') || path.endsWith('.js')) {
          importMapImports[path.slice(0, -3)] = blobUrl;
        }
      }

      // 4. Generate the index.html content
      const indexHtmlFile = currentVfs['/index.html'];
      if (!indexHtmlFile) {
        throw new Error('Missing /index.html in workspace root.');
      }

      let html = indexHtmlFile.content;

      // Console interception script
      const consoleScript = `
<script>
  (function() {
    const _log = console.log;
    const _error = console.error;
    const _warn = console.warn;
    
    console.log = function(...args) {
      _log.apply(console, args);
      window.parent.postMessage({ type: 'IFRAME_LOG', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    };
    console.error = function(...args) {
      _error.apply(console, args);
      window.parent.postMessage({ type: 'IFRAME_LOG', level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    };
    console.warn = function(...args) {
      _warn.apply(console, args);
      window.parent.postMessage({ type: 'IFRAME_LOG', level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    };
    window.onerror = function(message, source, lineno, colno, error) {
      window.parent.postMessage({ type: 'IFRAME_LOG', level: 'error', message: message + ' (' + source + ':' + lineno + ')' }, '*');
      return false;
    };
  })();
</script>
`;

      // Build CSS injection
      let cssLinksHtml = '';
      for (const [path, file] of Object.entries(currentVfs)) {
        if (path.endsWith('.css')) {
          const cssBlob = new Blob([file.content], { type: 'text/css' });
          const cssUrl = URL.createObjectURL(cssBlob);
          cssLinksHtml += `<link rel="stylesheet" href="${cssUrl}" />\n`;
        }
      }

      const importMapHtml = `
<script type="importmap">
{
  "imports": ${JSON.stringify(importMapImports, null, 2)}
}
</script>
`;

      // Resolve root index script
      const entryUrl = blobUrls['/src/index.tsx'] || blobUrls['/src/index.ts'] || blobUrls['/src/index.js'] || blobUrls['/index.js'];
      if (!entryUrl) {
        throw new Error('No entry script found. Expected /src/index.tsx or /src/index.ts');
      }
      const entryScriptHtml = `<script type="module" src="${entryUrl}"></script>`;

      // Inject compiled configs to HTML
      const headInsertions = `${consoleScript}\n${cssLinksHtml}\n${importMapHtml}`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${headInsertions}\n</head>`);
      } else {
        html = headInsertions + html;
      }

      if (html.includes('</body>')) {
        html = html.replace('</body>', `${entryScriptHtml}\n</body>`);
      } else {
        html = html + entryScriptHtml;
      }

      const finalHtmlBlob = new Blob([html], { type: 'text/html' });
      const finalHtmlUrl = URL.createObjectURL(finalHtmlBlob);

      setPreviewUrl(finalHtmlUrl);
      setTerminalLogs(prev => [
        ...prev,
        '✓ Build successful!',
        `✓ Bundled ${Object.keys(compiledFiles).length} scripts and loaded ${Object.keys(assetBlobUrls).length} asset files.`
      ]);
    } catch (err: any) {
      setErrorMessage(err.message);
      setTerminalLogs(prev => [...prev, `❌ Compilation Failed: ${err.message}`]);
    } finally {
      setIsCompiling(false);
    }
  }, [babelLoaded]);

  // Initial Compile
  useEffect(() => {
    if (babelLoaded) {
      compileVFS(vfs);
    }
  }, [babelLoaded]);

  // Flat VFS keys to Nested Tree Nodes converter
  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', type: 'directory', children: {} };

    for (const path of Object.keys(vfs)) {
      const parts = path.split('/').filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = '/' + parts.slice(0, i + 1).join('/');

        if (!current.children) current.children = {};

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: isFile ? undefined : {}
          };
        }
        current = current.children[part];
      }
    }
    return root;
  }, [vfs]);

  // Handlers for VFS Management
  const handleCreateFile = () => {
    const name = prompt('Enter file path (e.g. /src/components/Navbar.tsx):');
    if (!name) return;
    const cleanPath = name.startsWith('/') ? name : '/' + name;
    if (vfs[cleanPath]) {
      alert('File already exists!');
      return;
    }
    setVfs(prev => ({
      ...prev,
      [cleanPath]: { content: '', isBinary: false }
    }));
    setActiveFilePath(cleanPath);
    setTerminalLogs(prev => [...prev, `[SYSTEM] Created file ${cleanPath}`]);
  };

  const handleCreateFolder = () => {
    const name = prompt('Enter folder path (e.g. /src/utils):');
    if (!name) return;
    const cleanPath = name.startsWith('/') ? name : '/' + name;
    const mockFile = `${cleanPath}/.keep`;
    setVfs(prev => ({
      ...prev,
      [mockFile]: { content: '', isBinary: false }
    }));
    setTerminalLogs(prev => [...prev, `[SYSTEM] Created folder ${cleanPath}`]);
  };

  const handleDeleteFile = (path: string) => {
    if (path === '/index.html' || path === '/src/index.tsx') {
      alert('Cannot delete core framework files.');
      return;
    }
    if (confirm(`Are you sure you want to delete ${path}?`)) {
      setVfs(prev => {
        const updated = { ...prev };
        delete updated[path];
        return updated;
      });
      if (activeFilePath === path) {
        setActiveFilePath('/src/App.tsx');
      }
      setTerminalLogs(prev => [...prev, `[SYSTEM] Deleted file ${path}`]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    // Check if image or text
    const isImage = file.type.startsWith('image/');
    const destFolder = isImage ? '/src/assets' : '/src';
    const filePath = `${destFolder}/${file.name}`;

    reader.onload = (event) => {
      const content = event.target?.result as string;
      setVfs(prev => ({
        ...prev,
        [filePath]: { content, isBinary: isImage, mimeType: file.type }
      }));
      setActiveFilePath(filePath);
      setTerminalLogs(prev => [...prev, `[SYSTEM] Uploaded file ${filePath}`]);
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleEditorChange = (val: string) => {
    setEditorContent(val);
    setEditorSaveStatus('Saving...');
    setVfs(prev => ({
      ...prev,
      [activeFilePath]: {
        ...prev[activeFilePath],
        content: val
      }
    }));
    setEditorSaveStatus('Saved');
  };

  // Keyboard editor helper: tab indentation
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newContent = editorContent.substring(0, start) + "  " + editorContent.substring(end);
      setEditorContent(newContent);
      
      setVfs(prev => ({
        ...prev,
        [activeFilePath]: {
          ...prev[activeFilePath],
          content: newContent
        }
      }));

      // Reset selection range
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Download Workspace ZIP exporter
  const handleDownloadZip = async () => {
    setTerminalLogs(prev => [...prev, '📦 Packaging project zip archive...']);
    try {
      // Dynamically load JSZip
      const JSZip: any = await new Promise((resolve, reject) => {
        if ((window as any).JSZip) {
          resolve((window as any).JSZip);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve((window as any).JSZip);
        script.onerror = () => reject(new Error('Failed to load JSZip from CDN.'));
        document.head.appendChild(script);
      });

      const zip = new JSZip();
      for (const [path, file] of Object.entries(vfs)) {
        // Strip leading slash
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        if (file.isBinary) {
          const base64Data = file.content.split(',')[1];
          zip.file(cleanPath, base64Data, { base64: true });
        } else {
          zip.file(cleanPath, file.content);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'promax-workspace.zip';
      link.click();
      setTerminalLogs(prev => [...prev, '✓ Zip downloaded successfully!']);
    } catch (e: any) {
      setTerminalLogs(prev => [...prev, `❌ Package failed: ${e.message}`]);
    }
  };

  // Change workspace template
  const handleLoadTemplate = (type: 'react' | 'threejs') => {
    if (confirm(`Reset workspace and load ${type} template? This will discard your current edits.`)) {
      const templateData = TEMPLATES[type];
      const newVfs = Object.fromEntries(
        Object.entries(templateData).map(([k, v]) => [k, { content: v, isBinary: false }])
      );
      setVfs(newVfs);
      setActiveFilePath('/src/App.tsx');
      setTerminalLogs(prev => [...prev, `[SYSTEM] Loaded template: ${type}`]);
      
      setTimeout(() => {
        compileVFS(newVfs);
      }, 100);
    }
  };

  // Streaming commands executor: executes write/delete/run commands on VFS
  const executeAgentCommands = async (text: string, isFinal: boolean) => {
    let hasEdits = false;
    const writeRegex = /<write_file\s+path=["']([^"']+)["']>([\s\S]*?)(<\/write_file>|$)/g;
    let match;
    const parsedVfs = { ...vfs };

    // Process file writes
    while ((match = writeRegex.exec(text)) !== null) {
      const path = match[1];
      const content = match[2];
      const isComplete = match[3] === '</write_file>';

      const cleanPath = path.startsWith('/') ? path : '/' + path;
      if (isComplete && (!vfs[cleanPath] || vfs[cleanPath].content !== content)) {
        parsedVfs[cleanPath] = { content: content.trim(), isBinary: false };
        hasEdits = true;
        setTerminalLogs(prev => [...prev, `[AGENT] Wrote file ${cleanPath}`]);
      }
    }

    // Process file deletes
    const deleteRegex = /<delete_file\s+path=["']([^"']+)["']\s*\/>/g;
    while ((match = deleteRegex.exec(text)) !== null) {
      const path = match[1];
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      if (parsedVfs[cleanPath]) {
        delete parsedVfs[cleanPath];
        hasEdits = true;
        setTerminalLogs(prev => [...prev, `[AGENT] Deleted file ${cleanPath}`]);
      }
    }

    if (hasEdits) {
      setVfs(parsedVfs);
    }

    // Process build commands
    const runRegex = /<run_command>([\s\S]*?)(<\/run_command>|$)/g;
    while ((match = runRegex.exec(text)) !== null) {
      const command = match[1].trim();
      const isComplete = match[2] === '</run_command>';

      if (isComplete && command === 'npm run build' && isFinal) {
        setTerminalLogs(prev => [...prev, '$ npm run build']);
        await compileVFS(hasEdits ? parsedVfs : vfs);
      }
    }
  };

  // Helper to execute research tools and trigger follow-up agent cycles
  const executeResearchTools = async (text: string, currentMessages: ChatMessage[], currentVfs: VFS, depth: number) => {
    if (depth > 8) {
      setTerminalLogs(prev => [...prev, '⚠️ Max tool-loop depth reached. Stopping.']);
      return;
    }

    let toolResultContent = '';
    
    // 1. Process <read_file path="..." />
    const readRegex = /<read_file\s+path=["']([^"']+)["']\s*\/>/g;
    let match;
    while ((match = readRegex.exec(text)) !== null) {
      const path = match[1];
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      if (currentVfs[cleanPath]) {
        if (currentVfs[cleanPath].isBinary) {
          toolResultContent += `\n\n[Tool Result - read_file "${cleanPath}"]\nBinary file (size: ${currentVfs[cleanPath].content.length} chars)`;
        } else {
          toolResultContent += `\n\n[Tool Result - read_file "${cleanPath}"]\n\`\`\`\n${currentVfs[cleanPath].content}\n\`\`\``;
        }
        setTerminalLogs(prev => [...prev, `[SYSTEM] Read file ${cleanPath}`]);
      } else {
        toolResultContent += `\n\n[Tool Result - read_file "${cleanPath}"]\nError: File not found.`;
        setTerminalLogs(prev => [...prev, `[SYSTEM] Failed to read ${cleanPath}: file not found`]);
      }
    }

    // 2. Process <grep_search query="..." />
    const grepRegex = /<grep_search\s+query=["']([^"']+)["']\s*\/>/g;
    while ((match = grepRegex.exec(text)) !== null) {
      const query = match[1].toLowerCase();
      let grepResults = '';
      let matchCount = 0;
      
      for (const [filePath, file] of Object.entries(currentVfs)) {
        if (file.isBinary) continue;
        const lines = file.content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(query)) {
            matchCount++;
            if (matchCount <= 40) { // Limit results to prevent context overload
              grepResults += `- ${filePath}:L${idx + 1}: ${line.trim()}\n`;
            }
          }
        });
      }

      if (matchCount > 0) {
        toolResultContent += `\n\n[Tool Result - grep_search "${query}"]\nFound ${matchCount} matches:\n${grepResults}`;
        if (matchCount > 40) toolResultContent += `(Truncated matches above 40)\n`;
        setTerminalLogs(prev => [...prev, `[SYSTEM] Searched files for "${query}" (found ${matchCount} matches)`]);
      } else {
        toolResultContent += `\n\n[Tool Result - grep_search "${query}"]\nNo matches found.`;
        setTerminalLogs(prev => [...prev, `[SYSTEM] Searched files for "${query}" (no matches)`]);
      }
    }

    // 3. Process <find_files query="..." />
    const findRegex = /<find_files\s+query=["']([^"']+)["']\s*\/>/g;
    while ((match = findRegex.exec(text)) !== null) {
      const query = match[1].toLowerCase();
      let findResults = '';
      let matchCount = 0;

      for (const filePath of Object.keys(currentVfs)) {
        if (filePath.toLowerCase().includes(query)) {
          matchCount++;
          findResults += `- ${filePath}\n`;
        }
      }

      if (matchCount > 0) {
        toolResultContent += `\n\n[Tool Result - find_files "${query}"]\nFound ${matchCount} files:\n${findResults}`;
        setTerminalLogs(prev => [...prev, `[SYSTEM] Found ${matchCount} files matching "${query}"`]);
      } else {
        toolResultContent += `\n\n[Tool Result - find_files "${query}"]\nNo matching files found.`;
        setTerminalLogs(prev => [...prev, `[SYSTEM] No files matching "${query}"`]);
      }
    }

    // If we gathered any tool results, append them to history and trigger the follow-up agent call
    if (toolResultContent.trim()) {
      const systemMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'system',
        content: toolResultContent.trim()
      };

      const updatedMessages = [...currentMessages, systemMsg];
      setMessages(updatedMessages);
      setTerminalLogs(prev => [...prev, `[SYSTEM] Feeding tool results back to agent...`]);
      
      // Auto-trigger agent loop continuation
      await triggerAgentLoopContinuation(updatedMessages, currentVfs, depth + 1);
    }
  };

  const triggerAgentLoopContinuation = async (currentMessages: ChatMessage[], currentVfs: VFS, depth: number) => {
    setIsStreaming(true);
    setStreamedContent('');
    setStreamedReasoning('');
    setSystemActivity('Agent is planning next step...');

    const fileListText = Object.keys(currentVfs).join('\n');
    const systemPromptContext = `
You are compiling inside a browser editor.
Workspace contents:
${fileListText}

Active edited file in editor: ${activeFilePath}
`;

    // Map history to simple streaming structure
    const chatHistory = currentMessages.map((m, idx) => ({
      id: idx + 1,
      content: m.content,
      isAI: m.role === 'assistant'
    }));

    const finalHistory = [
      { id: 0, content: systemPromptContext, isAI: false },
      ...chatHistory
    ];

    try {
      await generateAIResponseStreaming(
        finalHistory,
        undefined,
        '',
        'pro',
        undefined,
        undefined,
        undefined,
        undefined,
        (chunk) => {
          setStreamedContent(prev => prev + chunk);
        },
        async (completeResponse) => {
          setIsStreaming(false);
          setSystemActivity(null);

          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: completeResponse.content,
            thinking: completeResponse.thinking
          };

          const newMessages = [...currentMessages, agentMsg];
          setMessages(newMessages);

          // 1. Execute modifications (write, delete, build)
          await executeAgentCommands(completeResponse.content, true);

          // 2. Check for research tools and recursively trigger loop if needed!
          await executeResearchTools(completeResponse.content, newMessages, currentVfs, depth);
        },
        (error) => {
          setIsStreaming(false);
          setSystemActivity(null);
          setTerminalLogs(prev => [...prev, `[ERR] Agent Loop Call Failed: ${error.message}`]);
        },
        user?.id,
        undefined,
        'promax',
        (status) => {
          if (status === 'thinking') setSystemActivity('Thinking...');
          else setSystemActivity(status);
        }
      );
    } catch (e: any) {
      setIsStreaming(false);
      setSystemActivity(null);
      setTerminalLogs(prev => [...prev, `[ERR] Agent Loop Continuation failed: ${e.message}`]);
    }
  };

  // Submit chat prompt to agent
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userText = inputValue;
    setInputValue('');
    setErrorMessage(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamedContent('');
    setStreamedReasoning('');
    setSystemActivity('Agent is planning...');

    // Build context with current workspace file tree and details
    const fileListText = Object.keys(vfs).join('\n');
    const systemPromptContext = `
You are compiling inside a browser editor.
Workspace contents:
${fileListText}

Active edited file in editor: ${activeFilePath}
Active file content:
${vfs[activeFilePath]?.content || 'Empty'}
`;

    // Map history to simple streaming structure
    const chatHistory = messages.map((m, idx) => ({
      id: idx + 1,
      content: m.content,
      isAI: m.role === 'assistant'
    }));

    // Append the system prompt context to the final query or prepend to history
    const finalHistory = [
      { id: 0, content: systemPromptContext, isAI: false },
      ...chatHistory,
      { id: messages.length + 1, content: userText, isAI: false }
    ];

    try {
      await generateAIResponseStreaming(
        finalHistory,
        undefined, // imageData
        '', // systemPrompt (overridden by specialMode)
        'pro', // base persona
        undefined, // audio
        undefined, // heat level
        undefined, // imageUrls
        undefined, // dimensions
        (chunk) => {
          setStreamedContent(prev => prev + chunk);
        },
        async (completeResponse) => {
          setIsStreaming(false);
          setSystemActivity(null);

          // Build final response with reasoning
          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: completeResponse.content,
            thinking: completeResponse.thinking
          };

          const newMessages = [...messages, userMessage, agentMsg];
          setMessages(newMessages);
          
          // Execute edits and builds on final complete stream
          await executeAgentCommands(completeResponse.content, true);

          // Execute research tools check
          await executeResearchTools(completeResponse.content, newMessages, vfs, 0);
        },
        (error) => {
          setIsStreaming(false);
          setSystemActivity(null);
          setTerminalLogs(prev => [...prev, `[ERR] Agent Call Failed: ${error.message}`]);
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'system',
              content: `⚠️ Failed to connect to PRO MAX agent: ${error.message}`
            }
          ]);
        },
        user?.id,
        undefined, // memories
        'promax', // specialMode
        (status) => {
          // Map system tags
          if (status === 'thinking') setSystemActivity('Thinking...');
          else if (status.startsWith('writing_file')) setSystemActivity(`Writing file...`);
          else setSystemActivity(status);
        }
      );
    } catch (e: any) {
      setIsStreaming(false);
      setSystemActivity(null);
      setTerminalLogs(prev => [...prev, `[ERR] Chat Submission failed: ${e.message}`]);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent, streamedReasoning]);

  // Recursive Tree Renderer for VFS Sidebar
  const renderTree = (node: TreeNode, level: number = 0) => {
    const isCollapsed = collapsedPaths[node.path] || false;
    
    const toggleCollapse = (path: string) => {
      setCollapsedPaths(prev => ({
        ...prev,
        [path]: !prev[path]
      }));
    };

    if (node.type === 'directory') {
      // Root element is directory but without folder label
      if (node.name === 'root') {
        return (
          <div className="flex flex-col gap-0.5">
            {node.children && Object.values(node.children)
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => renderTree(child, level))}
          </div>
        );
      }

      return (
        <div key={node.path} className="flex flex-col">
          <div 
            onClick={() => toggleCollapse(node.path)}
            className="flex items-center justify-between py-1 px-2 hover:bg-white/5 rounded-lg cursor-pointer text-gray-300 select-none text-xs"
            style={{ paddingLeft: `${level * 10 + 6}px` }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-gray-500 flex-shrink-0">
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
              <Folder className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span className="truncate font-medium">{node.name}</span>
            </div>
          </div>
          {!isCollapsed && node.children && (
            <div className="flex flex-col">
              {Object.values(node.children)
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map(child => renderTree(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const isActive = activeFilePath === node.path;
    const isIndex = node.name === 'index.html';
    return (
      <div 
        key={node.path}
        className={`flex items-center justify-between py-1 px-2 hover:bg-white/5 rounded-lg cursor-pointer group text-xs transition-colors ${isActive ? 'bg-cyan-500/15 text-cyan-400 border-l border-cyan-400 font-semibold' : 'text-gray-400'}`}
        style={{ paddingLeft: `${level * 10 + 20}px` }}
        onClick={() => setActiveFilePath(node.path)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-500 flex-shrink-0">
            {node.name.endsWith('.css') ? <Code className="w-3.5 h-3.5 text-blue-400" /> : 
             node.name.endsWith('.html') ? <Code className="w-3.5 h-3.5 text-orange-400" /> :
             node.name.match(/\.(png|jpg|jpeg|gif|svg)$/i) ? <Image className="w-3.5 h-3.5 text-emerald-400" /> :
             <Code className="w-3.5 h-3.5 text-cyan-400" />}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        {!isIndex && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFile(node.path);
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 transition-opacity"
            title="Delete File"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  // Simple lines list generator for code editor
  const editorLines = useMemo(() => {
    return Array.from({ length: editorContent.split('\n').length }, (_, i) => i + 1);
  }, [editorContent]);

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden relative"
      style={{
        background: 'radial-gradient(circle at bottom, rgba(34, 211, 238, 0.09) 0%, rgba(3, 0, 16, 1) 100%), #030010'
      }}
    >
      {/* 🧭 Top Bar Layout */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-cyan-400 transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to TimeMachine
          </button>
          
          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <h1 className="text-sm font-semibold tracking-wider text-cyan-400 font-mono">PRO MAX SANDBOX</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Template Switcher */}
          <select 
            onChange={(e) => handleLoadTemplate(e.target.value as 'react' | 'threejs')}
            className="bg-black/45 border border-white/10 text-white/70 hover:text-white rounded-lg text-xs px-2.5 py-1.5 outline-none cursor-pointer transition-colors"
            defaultValue="react"
          >
            <option value="react">React default</option>
            <option value="threejs">Three.js WebGL</option>
          </select>

          {/* ZIP Exporter */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-white transition-colors bg-cyan-950/45 border border-cyan-800/30 px-3 py-1.5 rounded-lg font-medium"
            title="Download Project ZIP"
          >
            <Download className="w-3.5 h-3.5" /> ZIP
          </button>

          {/* Reload / Recompile */}
          <button
            onClick={() => compileVFS(vfs)}
            disabled={isCompiling}
            className={`flex items-center gap-1 text-xs text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 transition-colors px-3.5 py-1.5 rounded-lg font-semibold shadow-lg shadow-cyan-500/10 ${isCompiling ? 'animate-pulse' : ''}`}
          >
            <Play className="w-3.5 h-3.5 fill-black" /> Run
          </button>
        </div>
      </header>

      {/* 🌌 Workspace Layout Panels */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* 💬 Left Column: PRO MAX Chat Assistant */}
        <div className="w-[450px] border-r border-white/5 flex flex-col bg-black/35 backdrop-blur-xl flex-shrink-0">
          
          {/* Agent Identity details */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-gradient-to-r from-cyan-950/20 to-black/10">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/50 border border-cyan-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide font-mono">TimeMachine PRO MAX</div>
              <div className="text-[10px] text-cyan-400/70 font-mono">Tony Stark-level AI Engineer</div>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 space-y-3">
                <Brain className="w-10 h-10 text-cyan-500/30 animate-pulse" />
                <div>
                  <h4 className="text-xs font-semibold text-white/50 mb-1">Interactive Coding Agent</h4>
                  <p className="text-[11px] leading-relaxed max-w-xs">
                    Ask the agent to build widgets, add routes, style elements, or mock packages. It will create/edit files and run builds.
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                
                {/* Thinking accordion for <reason> block */}
                {msg.thinking && (
                  <div className="mb-2 w-full max-w-[90%] rounded-xl border border-purple-500/10 bg-purple-950/5 p-2.5 font-mono text-[10px] text-purple-300/80 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 mb-1 text-purple-400 font-semibold tracking-wider uppercase">
                      <Brain className="w-3.5 h-3.5" /> Agent Reason log
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{msg.thinking}</p>
                  </div>
                )}

                <div 
                  className={`max-w-[90%] rounded-2xl p-3.5 leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/20' 
                      : msg.role === 'system'
                      ? 'bg-red-950/10 text-red-400 border border-red-500/10 font-mono text-[11px]'
                      : 'bg-white/5 text-gray-300 border border-white/5 backdrop-blur-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Stream display for current streaming prompt */}
            {isStreaming && (streamedReasoning || streamedContent) && (
              <div className="flex flex-col items-start">
                {streamedReasoning && (
                  <div className="mb-2 w-full max-w-[90%] rounded-xl border border-purple-500/10 bg-purple-950/5 p-2.5 font-mono text-[10px] text-purple-300/80">
                    <div className="flex items-center gap-1.5 mb-1 text-purple-400 font-semibold uppercase">
                      <Brain className="w-3.5 h-3.5" /> Reasoning...
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{streamedReasoning}</p>
                  </div>
                )}
                
                {streamedContent && (
                  <div className="max-w-[90%] rounded-2xl p-3.5 bg-white/5 text-gray-300 border border-white/5 backdrop-blur-sm leading-relaxed">
                    <p className="whitespace-pre-wrap">{streamedContent}</p>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Action indicator bar */}
          {systemActivity && (
            <div className="px-4 py-1.5 bg-cyan-950/30 border-t border-cyan-900/20 flex items-center gap-2 text-[10px] font-mono text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>{systemActivity}</span>
            </div>
          )}

          {/* Chat input box */}
          <div className="p-4 border-t border-white/5 bg-black/20 flex gap-2">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isStreaming}
              placeholder="Ask PRO MAX to write files, run tests..."
              className="flex-1 bg-black/45 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
            />
            <button 
              onClick={handleSendMessage}
              disabled={isStreaming || !inputValue.trim()}
              className="w-10 h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4 fill-black" />
            </button>
          </div>
        </div>

        {/* 🖥️ Right Column: Tabbed Workspace container */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/10">
          
          {/* Tab switches */}
          <div className="h-11 bg-black/35 border-b border-white/5 flex items-center px-4 justify-between flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'code' ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              >
                <Code className="w-3.5 h-3.5 inline mr-1.5" /> Workspace Code
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'preview' ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              >
                <Layout className="w-3.5 h-3.5 inline mr-1.5" /> App Preview
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'terminal' ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              >
                <TerminalIcon className="w-3.5 h-3.5 inline mr-1.5" /> Terminal
              </button>
            </div>

            {activeTab === 'code' && (
              <span className="text-[10px] font-mono text-white/40 tracking-wider">
                EDITING: {activeFilePath}
              </span>
            )}
          </div>

          {/* Tab Views content container */}
          <div className="flex-1 overflow-hidden min-h-0 relative">
            
            {/* 📁 TAB 1: CODE EDITOR & VFS SIDEBAR */}
            {activeTab === 'code' && (
              <div className="h-full flex overflow-hidden min-h-0">
                
                {/* Collapsible File Explorer panel */}
                {!isExplorerCollapsed && (
                  <div className="w-56 border-r border-white/5 bg-black/20 flex flex-col flex-shrink-0 min-h-0">
                    <div className="p-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                      <span className="text-[10px] font-bold text-white/50 tracking-wider uppercase font-mono">Codebase files</span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={handleCreateFile}
                          className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                          title="New File"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={handleCreateFolder}
                          className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                          title="New Folder"
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                        <label 
                          className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white cursor-pointer"
                          title="Upload Local Asset"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <input type="file" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>

                    {/* VFS Tree Rendering */}
                    <div className="flex-1 overflow-y-auto p-2 min-h-0">
                      {renderTree(fileTree)}
                    </div>
                  </div>
                )}

                {/* Vertical collapser toggle for sidebar explorer */}
                <button 
                  onClick={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
                  className="w-1.5 hover:bg-cyan-500/20 hover:border-cyan-500/30 border-r border-white/5 flex items-center justify-center transition-colors cursor-col-resize flex-shrink-0"
                  title={isExplorerCollapsed ? "Show File Explorer" : "Hide File Explorer"}
                />

                {/* Main Textarea Code Editor */}
                <div className="flex-1 flex flex-col bg-black/5 min-h-0">
                  {vfs[activeFilePath]?.isBinary ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/40">
                      <Image className="w-12 h-12 text-cyan-500/20 mb-2" />
                      <div className="text-xs font-semibold text-white/60 mb-1">{activeFilePath.split('/').pop()}</div>
                      <div className="text-[10px] text-gray-500 mb-4">Binary Asset - Loaded as DataURL</div>
                      <img src={vfs[activeFilePath].content} alt="preview" className="max-h-60 max-w-sm rounded-xl border border-white/10 shadow-xl" />
                    </div>
                  ) : (
                    <div className="flex-1 flex overflow-hidden min-h-0 relative">
                      
                      {/* Lines display on left */}
                      <div className="w-10 select-none text-right pr-3 pl-1 py-4 font-mono text-[10px] text-white/20 bg-black/10 border-r border-white/5 flex flex-col select-none overflow-hidden h-full flex-shrink-0">
                        {editorLines.map((line) => (
                          <div key={line} className="h-5 leading-5">{line}</div>
                        ))}
                      </div>

                      {/* Code Input field */}
                      <textarea
                        value={editorContent}
                        onChange={(e) => handleEditorChange(e.target.value)}
                        onKeyDown={handleEditorKeyDown}
                        spellCheck="false"
                        className="flex-1 bg-transparent text-gray-300 font-mono text-xs p-4 focus:outline-none resize-none leading-5 h-full overflow-y-auto"
                        style={{ tabSize: 2 }}
                        placeholder="Write code here..."
                      />

                      {/* Floating Save/Status tag */}
                      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[10px] font-mono bg-black/70 backdrop-blur-md px-2.5 py-1.2 rounded-md border border-white/5 text-white/50">
                        <span className={`w-1.5 h-1.5 rounded-full ${editorSaveStatus === 'Saved' ? 'bg-cyan-400' : 'bg-yellow-400 animate-ping'}`} />
                        <span>{editorSaveStatus}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🌐 TAB 2: LIVE APP PREVIEW PANEL */}
            {activeTab === 'preview' && (
              <div className="h-full flex flex-col bg-black/40 min-h-0 p-4">
                
                {/* Browser bar layout */}
                <div className="h-10 bg-black/55 border border-white/5 rounded-t-xl flex items-center justify-between px-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  
                  {/* Mock URL bar */}
                  <div className="bg-black/35 border border-white/5 rounded-md px-4 py-1 text-[10px] font-mono text-white/40 w-1/2 text-center select-none truncate">
                    http://localhost:3000{activeFilePath.substring(0, activeFilePath.lastIndexOf('/'))}
                  </div>

                  {/* Responsive display sizes */}
                  <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                    <button 
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.2 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-cyan-400 text-black' : 'text-gray-400 hover:text-white'}`}
                      title="Desktop Layout"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setPreviewDevice('tablet')}
                      className={`p-1.2 rounded transition-colors ${previewDevice === 'tablet' ? 'bg-cyan-400 text-black' : 'text-gray-400 hover:text-white'}`}
                      title="Tablet Layout"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.2 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-cyan-400 text-black' : 'text-gray-400 hover:text-white'}`}
                      title="Mobile Layout"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sandboxed iframe holder */}
                <div className="flex-1 bg-black/10 border-x border-b border-white/5 rounded-b-xl flex items-center justify-center p-4 overflow-hidden relative">
                  {errorMessage ? (
                    <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 max-w-md text-center">
                      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                      <h4 className="text-xs font-semibold text-white mb-2">Build Error</h4>
                      <p className="text-[10px] font-mono text-red-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">{errorMessage}</p>
                    </div>
                  ) : previewUrl ? (
                    <motion.div 
                      layout
                      className="h-full bg-white rounded-lg shadow-2xl overflow-hidden"
                      style={{
                        width: previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '100%',
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <iframe 
                        ref={iframeRef}
                        src={previewUrl}
                        title="Sandbox Application Frame"
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                      />
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-white/30 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin text-cyan-500/40" />
                      <span>Packaging build bundle...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🐚 TAB 3: TERMINAL / LOGS CONSOLE */}
            {activeTab === 'terminal' && (
              <div className="h-full flex flex-col bg-black/55 p-4 font-mono text-[11px] leading-relaxed overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-none min-h-0">
                  {terminalLogs.map((log, index) => (
                    <div 
                      key={index}
                      className={
                        log.startsWith('❌') || log.includes('🔴') 
                          ? 'text-red-400' 
                          : log.startsWith('✓') || log.includes('🟢')
                          ? 'text-cyan-400'
                          : log.startsWith('$')
                          ? 'text-white font-bold'
                          : 'text-gray-400'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
                
                {/* Mock shell input */}
                <div className="h-8 border-t border-white/5 flex items-center pt-2 flex-shrink-0 gap-2">
                  <span className="text-cyan-400 font-semibold">$</span>
                  <input 
                    type="text" 
                    placeholder="Enter terminal command (e.g. build, clear, ls)..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.currentTarget;
                        const command = target.value.trim();
                        if (!command) return;
                        
                        setTerminalLogs(prev => [...prev, `$ ${command}`]);
                        target.value = '';

                        if (command === 'clear') {
                          setTerminalLogs([]);
                        } else if (command === 'build' || command === 'npm run build') {
                          compileVFS(vfs);
                        } else if (command === 'ls') {
                          setTerminalLogs(prev => [...prev, ...Object.keys(vfs)]);
                        } else if (command === 'help') {
                          setTerminalLogs(prev => [
                            ...prev,
                            'Available commands:',
                            '  build / npm run build  - Compile and reload project preview',
                            '  ls                     - List VFS files paths',
                            '  clear                  - Clear terminal log lines',
                            '  help                   - Display help options'
                          ]);
                        } else {
                          setTerminalLogs(prev => [...prev, `command not found: ${command}. Type 'help' for info.`]);
                        }
                      }
                    }}
                    className="flex-1 bg-transparent text-white outline-none border-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
