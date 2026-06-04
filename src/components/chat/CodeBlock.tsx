import React, { useState, useCallback } from 'react';
import { Copy, Check, Play } from 'lucide-react';
import { HtmlPreviewModal } from './HtmlPreviewModal';

interface CodeBlockProps {
  language?: string;
  code: string;
  themeText: string;
}

export function CodeBlock({ language, code, themeText }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isHtml = language === 'html' || language === 'htm';

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

  const glassButton = "p-1.5 rounded-lg transition-all duration-200 hover:scale-105";
  const glassStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  };

  return (
    <>
      <div className="relative mb-4 rounded-lg overflow-hidden" style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        {/* Top bar with language label and buttons */}
        <div className="flex items-center justify-between px-4 py-2" style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
            {language || 'code'}
          </span>

          <div className="flex items-center gap-1.5">
            {isHtml && (
              <button
                onClick={() => setShowPreview(true)}
                className={glassButton}
                style={glassStyle}
                title="Preview HTML"
              >
                <span className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Play className="w-3.5 h-3.5" />
                  Preview
                </span>
              </button>
            )}

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
          </div>
        </div>

        {/* Code content */}
        <pre className={`p-4 overflow-x-auto font-mono text-sm ${themeText}`}>
          <code>{code}</code>
        </pre>
      </div>

      <HtmlPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        htmlCode={code}
      />
    </>
  );
}
