import { BriefcaseBusiness, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
export type InterfaceMode = 'chat' | 'work';
export function InterfaceModeSwitcher({ value, onChange }: { value: InterfaceMode; onChange: (mode: InterfaceMode) => void }) {
  const reducedMotion = useReducedMotion();
  return <div className="tm-interface-switch" role="group" aria-label="Interface mode">
    {(['chat', 'work'] as const).map(mode => <button type="button" key={mode} aria-pressed={value === mode} onClick={() => onChange(mode)}>
      {value === mode && <motion.span className="tm-interface-selection" layoutId="tm-interface-selection" transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.28 }} aria-hidden="true" />}
      <span className="tm-interface-label">{mode === 'chat' ? <MessageCircle size={15} aria-hidden="true" /> : <BriefcaseBusiness size={15} aria-hidden="true" />}{mode === 'chat' ? 'Chat' : 'Work'}</span>
    </button>)}
  </div>;
}
