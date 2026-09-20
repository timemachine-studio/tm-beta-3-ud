import React from 'react';
import { Calculator, Equal } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { AccentTheme, IconBadge, HintView, FooterHint } from './shared';

export function CalculatorView({ module, accent }: { module: ModuleData; accent: AccentTheme }) {
  const calc = module.calculator;
  if (!calc && module.focused) {
    return <HintView icon={Calculator} accent={accent} text={MODULE_META.calculator.placeholder} />;
  }
  if (!calc) return null;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Equal} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/40 text-xs font-mono mb-1 truncate">{calc.expression}</div>
          <div className={`text-xl font-semibold tracking-tight ${calc.isPartial ? 'text-white/50' : 'text-white'}`}>
            {calc.displayResult}
          </div>
        </div>
      </div>
      {!calc.isPartial && (
        <FooterHint text="Press Enter to copy result" />
      )}
    </div>
  );
}
