import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  content: string;
}

export function ErrorMessage({ content }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <AlertCircle className="w-8 h-8 text-yellow-500" />
      <p className="text-xl text-yellow-500">{content}</p>
    </div>
  );
}
