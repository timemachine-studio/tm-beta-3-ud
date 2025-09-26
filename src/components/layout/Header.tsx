import React from 'react';
import { Bot } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4">
      <div className="flex items-center justify-center gap-2">
        <Bot className="w-6 h-6 text-purple-600" />
        <h1 className="text-xl font-bold text-gray-800">TimeMachine</h1>
      </div>
    </header>
  );
}
