import React from 'react';

interface ShowHistoryProps {
  showHistory: boolean;
  onToggle: () => void;
}

export function ShowHistory({ showHistory, onToggle }: ShowHistoryProps) {
  return (
    <button
      onClick={onToggle}
      className="text-sm text-gray-400 hover:text-white transition-colors"
    >
      {showHistory ? 'Hide Messages' : 'Show Messages'}
    </button>
  );
}
