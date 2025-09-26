import React from 'react';
import { History } from 'lucide-react';

interface ToggleHistoryProps {
  showHistory: boolean;
  onToggle: () => void;
}

export function ToggleHistory({ showHistory, onToggle }: ToggleHistoryProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-24 right-4 p-3 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
    >
      <History className="w-5 h-5" />
    </button>
  );
}
