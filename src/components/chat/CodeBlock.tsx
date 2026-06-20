import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Maximize2, Code, Eye } from 'lucide-react';
import { HtmlPreviewModal } from './HtmlPreviewModal';

interface CodeBlockProps {
  language?: string;
  code: string;
  themeText: string;
  isComplete?: boolean;
}

export function CodeBlock({ language, code, themeText, isComplete = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const preRef = useRef<HTMLPreElement>(null);

  const isHtml = language === 'html' || language === 'htm';

  // Autoscroll during streaming
  useEffect(() => {
    if (preRef.current && !isComplete && activeTab === 'code') {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [code, isComplete, activeTab]);

  // Auto preview HTML when finished generating
  useEffect(() => {
    if (isHtml && isComplete) {
      setActiveTab('preview');
    }
  }, [isComplete, isHtml]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const glassButton = "p-1.5 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10 active:scale-95";
  const glassStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  };

  return (
    <>
      <div className="relative mb-4 rounded-xl overflow-hidden flex flex-col h-[380px] w-full" style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      }}>
        {/* Top bar with language label and buttons */}
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider select-none">
              {language || 'code'}
            </span>

            {isHtml && isComplete && (
              <div className="flex items-center gap-0.5 bg-black/20 rounded-lg p-0.5 border border-white/5 select-none">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                    activeTab === 'code'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  Code
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                    activeTab === 'preview'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className={glassButton}
              style={glassStyle}
              title="Copy code"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/70" />
              )}
            </button>

            {isHtml && (
              <button
                onClick={() => setShowPreview(true)}
                className={glassButton}
                style={glassStyle}
                title="Full Screen Preview"
              >
                <Maximize2 className="w-3.5 h-3.5 text-white/70" />
              </button>
            )}
          </div>
        </div>

        {/* Code or Preview content area */}
        <div className="flex-1 min-h-0 relative">
          {isHtml && activeTab === 'preview' ? (
            <div className="w-full h-full bg-white relative">
              <iframe
                srcDoc={code}
                title="HTML Preview Inline"
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <pre
              ref={preRef}
              className={`w-full h-full p-4 overflow-auto font-mono text-sm ${themeText}`}
              style={{ scrollbarWidth: 'thin' }}
            >
              <code>{code}</code>
            </pre>
          )}
        </div>
      </div>

      <HtmlPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        htmlCode={code}
      />
    </>
  );
}
