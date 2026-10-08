import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Expand, Eye, EyeOff, Moon, Sparkles, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ThinkingAnimationVisual } from '../chat/ThinkingAnimationVisual';
import { THINKING_ANIMATION_OPTIONS, type ThinkingAnimationChoice } from '../../config/thinkingAnimation';
import { paletteColor, seasonPalettes } from '../../themes/seasonPalette';
import type { SeasonTheme } from '../../themes/themeState';
import type { UiStyle } from '../../themes/uiStyle';
import './onboarding.css';

interface OnboardingModalProps { isOpen: boolean; onComplete: () => void }

const STEPS = [
  { label: 'Your name', title: 'First, make it yours.', description: 'A name for the conversation. A little context, only if you want to share it.' },
  { label: 'Interface', title: 'Choose your point of view.', description: 'Choose a visual style, then preview the real interface at full size before deciding.' },
  { label: 'Atmosphere', title: 'Set the atmosphere.', description: 'Choose the light, then give it a season. Auto follows the mind you use.' },
  { label: 'Motion', title: 'Find your rhythm.', description: 'Choose what appears while TimeMachine is thinking.' },
] as const;

const SEASONS: Array<{ value: SeasonTheme; label: string }> = [
  { value: 'springDark', label: 'Spring' }, { value: 'summerDark', label: 'Summer' },
  { value: 'autumnDark', label: 'Autumn' }, { value: 'winterDark', label: 'Winter' },
  { value: 'blossomDark', label: 'Blossom' }, { value: 'verdureDark', label: 'Verdure' },
  { value: 'emberDark', label: 'Ember' }, { value: 'sunflareDark', label: 'Sunflare' },
  { value: 'pureDark', label: 'Pure' },
];

const FEATURED_ANIMATIONS: ThinkingAnimationChoice[] = [
  'orb:composing:64', 'constellation', 'cubes', 'orb:weaving:64', 'orb:connecting:64', 'all-cycle',
];

function OrbitMark({ small = false }: { small?: boolean }) {
  return <svg aria-hidden="true" className={`tm-onboard-orbit-mark ${small ? 'is-small' : ''}`} viewBox="0 0 128 128" fill="none">
    <circle cx="64" cy="64" r="46" stroke="currentColor" strokeOpacity=".26" strokeWidth=".8" />
    <circle cx="64" cy="64" r="31" stroke="currentColor" strokeOpacity=".42" strokeWidth=".8" />
    <ellipse cx="64" cy="64" rx="51" ry="20" transform="rotate(-34 64 64)" stroke="currentColor" strokeOpacity=".72" strokeWidth="1.2" />
    <ellipse cx="64" cy="64" rx="51" ry="20" transform="rotate(42 64 64)" stroke="currentColor" strokeOpacity=".42" strokeWidth=".8" />
    <path d="M64 53l2.3 8.7L75 64l-8.7 2.3L64 75l-2.3-8.7L53 64l8.7-2.3L64 53Z" fill="currentColor" />
    <circle cx="27" cy="43" r="2" fill="currentColor" /><circle cx="98" cy="85" r="1.6" fill="currentColor" />
  </svg>;
}

function InterfacePreview({ variant }: { variant: UiStyle }) {
  return <span aria-hidden="true" className={`tm-onboard-interface-preview is-${variant}`}>
    <span className="tm-onboard-preview-top"><span className="tm-onboard-preview-star"><Sparkles size={10} strokeWidth={1.7} /></span><span className="tm-onboard-preview-top-line" /><span className="tm-onboard-preview-top-dot" /></span>
    <span className="tm-onboard-preview-room">{variant !== 'legacy' && <span className="tm-onboard-preview-rail"><i /><i /><i /></span>}<span className="tm-onboard-preview-center"><i /><i /><span /></span></span>
    <span className="tm-onboard-preview-composer"><i /><span /><i /></span>
  </span>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { updateProfile } = useAuth();
  const { uiStyle, setUiStyle, mode, setMode, season, seasonFollowsPersona, setSeason, thinkingAnimation, setThinkingAnimation, accentSeason } = useTheme();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [showAllAnimations, setShowAllAnimations] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewStyle, setPreviewStyle] = useState<UiStyle | null>(null);
  const [previewControlsHidden, setPreviewControlsHidden] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const presentPreviewRef = useRef<HTMLButtonElement>(null);
  const classicPreviewRef = useRef<HTMLButtonElement>(null);
  const legacyPreviewRef = useRef<HTMLButtonElement>(null);
  const previewOriginStyleRef = useRef<UiStyle>(uiStyle);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    if (!isOpen || step !== 3 || reducedMotion) return;
    const timer = window.setInterval(() => setAnimationStep(current => current + 1), 1300);
    return () => window.clearInterval(timer);
  }, [isOpen, step, reducedMotion]);

  const next = () => {
    if (step === 0 && !nickname.trim()) { setError('Add a name to continue.'); return; }
    setError('');
    setStep(current => Math.min(current + 1, STEPS.length - 1));
  };

  const openPreview = (style: UiStyle) => {
    previewOriginStyleRef.current = uiStyle;
    setUiStyle(style);
    setPreviewStyle(style);
    setPreviewControlsHidden(false);
    window.requestAnimationFrame(() => previewCloseRef.current?.focus());
  };

  const closePreview = () => {
    const style = previewStyle;
    setUiStyle(previewOriginStyleRef.current);
    setPreviewStyle(null);
    setPreviewControlsHidden(false);
    window.requestAnimationFrame(() => {
      const ref = style === 'legacy' ? legacyPreviewRef : style === 'classic' ? classicPreviewRef : presentPreviewRef;
      ref.current?.focus();
    });
  };

  const finish = async () => {
    if (loading) return;
    if (!nickname.trim()) { setStep(0); setError('Add a name to continue.'); return; }
    setLoading(true);
    setError('');
    const { error: updateError } = await updateProfile({ nickname: nickname.trim(), about_me: aboutMe.trim() || null });
    if (updateError) { setError(updateError.message || 'Your profile could not be saved. Try again.'); setLoading(false); return; }
    setLoading(false);
    onComplete();
  };

  const animationChoices = showAllAnimations ? THINKING_ANIMATION_OPTIONS : FEATURED_ANIMATIONS.map(value => THINKING_ANIMATION_OPTIONS.find(option => option.value === value)!).filter(Boolean);
  const animationColor = paletteColor(accentSeason, mode);

  return <Dialog.Root open={isOpen}>
    <AnimatePresence>
      {isOpen && <Dialog.Portal forceMount>
        <Dialog.Overlay asChild><motion.div className={`tm-onboard-scrim ${previewStyle ? 'is-preview' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
        <Dialog.Content asChild aria-describedby="tm-onboard-dialog-description" onEscapeKeyDown={event => { event.preventDefault(); if (previewStyle) closePreview(); }} onPointerDownOutside={event => event.preventDefault()}>
          <motion.div className={`tm-onboard-layer ${previewStyle ? 'is-preview' : ''}`} initial={reducedMotion ? false : { opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .985 }} transition={{ type: 'spring', stiffness: 360, damping: 32 }}>
            {previewStyle ? <div className={`tm-onboard-live-preview ${previewControlsHidden ? 'is-collapsed' : ''}`}>
              <Dialog.Title className="sr-only">Preview TimeMachine interfaces</Dialog.Title>
              <Dialog.Description id="tm-onboard-dialog-description" className="sr-only">Preview Present, Classic, and Legacy, then choose the interface you prefer.</Dialog.Description>
              {previewControlsHidden ? <button type="button" className="tm-onboard-preview-reveal" onClick={() => setPreviewControlsHidden(false)} aria-label="Show interface preview controls"><Eye size={18} /><span>Compare interfaces</span></button> : <div className="tm-onboard-preview-toolbar">
                <button type="button" className="tm-onboard-preview-close" ref={previewCloseRef} onClick={closePreview} aria-label="Back to interface choices"><X size={19} /></button>
                <div className="tm-onboard-preview-context"><strong>See the real layout</strong><span>Controls are paused while you compare.</span></div>
                <div className="tm-onboard-preview-switch" role="group" aria-label="Preview interface">
                  <button type="button" className={previewStyle === 'present' ? 'is-selected' : ''} aria-pressed={previewStyle === 'present'} onClick={() => { setUiStyle('present'); setPreviewStyle('present'); }}>Present</button>
                  <button type="button" className={previewStyle === 'classic' ? 'is-selected' : ''} aria-pressed={previewStyle === 'classic'} onClick={() => { setUiStyle('classic'); setPreviewStyle('classic'); }}>Classic</button>
                  <button type="button" className={previewStyle === 'legacy' ? 'is-selected' : ''} aria-pressed={previewStyle === 'legacy'} onClick={() => { setUiStyle('legacy'); setPreviewStyle('legacy'); }}>Legacy</button>
                </div>
                <button type="button" className="tm-onboard-preview-hide" onClick={() => setPreviewControlsHidden(true)} aria-label="Hide preview controls"><EyeOff size={18} /></button>
                <button type="button" className="tm-onboard-preview-use" onClick={() => { setPreviewStyle(null); setError(''); setStep(2); }}>Use {previewStyle[0].toUpperCase() + previewStyle.slice(1)} <ArrowRight size={16} /></button>
              </div>}
            </div> : <div className="tm-onboard-shell tm-workspace">
              <Dialog.Title className="sr-only">Set up TimeMachine</Dialog.Title>
              <Dialog.Description id="tm-onboard-dialog-description" className="sr-only">Choose your name, interface, appearance and thinking animation.</Dialog.Description>
              <aside className="tm-onboard-story" aria-hidden="true">
                <div className="tm-onboard-story-grain" />
                <div className="tm-onboard-story-top"><OrbitMark small /><span>TimeMachine</span></div>
                <div className="tm-onboard-art"><span className="tm-onboard-art-ring is-a" /><span className="tm-onboard-art-ring is-b" /><OrbitMark /></div>
                <div className="tm-onboard-story-bottom"><p className="tm-onboard-story-line">Make room for<br /><em>what comes next.</em></p><span className="tm-onboard-story-caption">Four small choices. Your own TimeMachine.</span></div>
              </aside>
              <div className="tm-onboard-main">
                <header className="tm-onboard-header">
                  <div className="tm-onboard-mobile-brand"><OrbitMark small /><span>TimeMachine</span></div>
                  <div className="tm-onboard-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].label}`}>{STEPS.map((item, index) => <span key={item.label} className={`tm-onboard-progress-segment ${index <= step ? 'is-filled' : ''}`} />)}</div>
                  <span className="tm-onboard-progress-count">{String(step + 1).padStart(2, '0')} / 04</span>
                </header>
                <div className="tm-onboard-body" ref={bodyRef}><AnimatePresence mode="wait" initial={false}>
                  <motion.section key={step} className="tm-onboard-step" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }} transition={{ duration: .22, ease: [0.2, 0.8, 0.2, 1] }} aria-labelledby="tm-onboard-step-title">
                    <h2 id="tm-onboard-step-title" className="tm-onboard-title">{STEPS[step].title}</h2>
                    <p className="tm-onboard-intro">{STEPS[step].description}</p>
                    {step === 0 && <div className="tm-onboard-fields">
                      <label className="tm-onboard-field"><span>What should we call you? <b>Required</b></span><input autoFocus autoComplete="nickname" maxLength={30} value={nickname} onChange={event => { setNickname(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') next(); }} placeholder="Your name or nickname" /></label>
                      <label className="tm-onboard-field"><span>A little about you <b>Optional</b></span><textarea rows={3} maxLength={500} value={aboutMe} onChange={event => setAboutMe(event.target.value)} placeholder="Interests, projects, or anything you'd like to share…" /></label>
                      <p className="tm-onboard-note">Your introduction lives in your profile. You can edit it later.</p>
                    </div>}
                    {step === 1 && <div className="tm-onboard-choice-grid tm-onboard-interface-grid" role="group" aria-label="Interface style">
                      {([
                        { value: 'present', label: 'Present', sub: 'New liquid glass with the sidebar layout.', tag: 'Recommended' },
                        { value: 'classic', label: 'Classic', sub: 'Seasonal glass with the original light and dark themes.', tag: 'Seasonal glass' },
                        { value: 'legacy', label: 'Legacy', sub: 'The original top bar and compact layout.', tag: 'Original layout' },
                      ] as const).map(option => <button key={option.value} type="button" className={`tm-onboard-choice tm-onboard-interface-card ${uiStyle === option.value ? 'is-selected' : ''}`} ref={option.value === 'present' ? presentPreviewRef : option.value === 'classic' ? classicPreviewRef : legacyPreviewRef} onClick={() => openPreview(option.value)} aria-pressed={uiStyle === option.value}><InterfacePreview variant={option.value} /><span className="tm-onboard-choice-copy"><span className="tm-onboard-choice-title">{option.label}<span className="tm-onboard-choice-tag">{option.tag}</span></span><span className="tm-onboard-choice-sub">{option.sub}</span></span><span className="tm-onboard-choice-check"><Check size={15} /></span><span className="tm-onboard-interface-preview-action"><Expand size={15} /> Preview full screen</span></button>)}
                    </div>}
                    {step === 2 && <div className="tm-onboard-appearance">
                      <div className="tm-onboard-choice-grid tm-onboard-mode-grid" role="group" aria-label="Appearance">
                        <button type="button" className={`tm-onboard-choice tm-onboard-mode-card ${mode === 'light' ? 'is-selected' : ''}`} aria-pressed={mode === 'light'} onClick={() => setMode('light')}><span className="tm-onboard-mode-icon is-light"><Sun size={24} strokeWidth={1.5} /></span><span className="tm-onboard-choice-copy"><span className="tm-onboard-choice-title">White</span><span className="tm-onboard-choice-sub">Soft light and warm paper.</span></span><span className="tm-onboard-choice-check"><Check size={15} /></span></button>
                        <button type="button" className={`tm-onboard-choice tm-onboard-mode-card ${mode === 'dark' ? 'is-selected' : ''}`} aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}><span className="tm-onboard-mode-icon is-dark"><Moon size={24} strokeWidth={1.5} /></span><span className="tm-onboard-choice-copy"><span className="tm-onboard-choice-title">Dark</span><span className="tm-onboard-choice-sub">A deeper seasonal sky.</span></span><span className="tm-onboard-choice-check"><Check size={15} /></span></button>
                      </div>
                      <div className="tm-onboard-subheading"><span>Seasonal accent</span><small>Auto follows Air, Girlie or PRO</small></div>
                      <div className="tm-onboard-season-grid" role="group" aria-label="Seasonal accent">
                        <button type="button" className={`tm-onboard-season ${seasonFollowsPersona ? 'is-selected' : ''}`} aria-pressed={seasonFollowsPersona} onClick={() => setSeason('auto')}><span className="tm-onboard-season-orb is-auto"><Sparkles size={18} /></span><span>Auto</span></button>
                        {SEASONS.map(option => <button key={option.value} type="button" className={`tm-onboard-season ${!seasonFollowsPersona && season === option.value ? 'is-selected' : ''}`} style={{ '--tm-onboard-swatch': `rgb(${seasonPalettes[option.value].rgb})` } as React.CSSProperties} aria-pressed={!seasonFollowsPersona && season === option.value} onClick={() => setSeason(option.value)}><span className={`tm-onboard-season-orb ${option.value === 'pureDark' ? 'is-pure' : ''}`} /><span>{option.label}</span></button>)}
                      </div>
                      <p className="tm-onboard-note">Chosen seasons stay put. Pure keeps the canvas black and follows your mind's accent.</p>
                    </div>}
                    {step === 3 && <div className="tm-onboard-motion">
                      <div className="tm-onboard-animation-grid" role="group" aria-label="Thinking animation">{animationChoices.map(option => <button key={option.value} type="button" className={`tm-onboard-animation ${thinkingAnimation === option.value ? 'is-selected' : ''}`} aria-pressed={thinkingAnimation === option.value} onClick={() => { setThinkingAnimation(option.value); setAnimationStep(0); }}><span className="tm-onboard-animation-visual"><ThinkingAnimationVisual choice={option.value} step={animationStep} color={animationColor} theme={mode} paused={thinkingAnimation !== option.value} preview /></span><span className="tm-onboard-animation-name">{option.label}</span>{thinkingAnimation === option.value && <Check className="tm-onboard-animation-check" size={14} />}</button>)}</div>
                      <button type="button" className="tm-onboard-more" onClick={() => setShowAllAnimations(value => !value)} aria-expanded={showAllAnimations}>{showAllAnimations ? 'Show a few favorites' : 'Explore all 22 animations'}<ChevronDown size={16} className={showAllAnimations ? 'is-open' : ''} /></button>
                      <p className="tm-onboard-note">Motion respects your device's reduced-motion setting. You can change this whenever you like.</p>
                    </div>}
                  </motion.section>
                </AnimatePresence></div>
                <footer className="tm-onboard-footer">
                  <div className="tm-onboard-footer-copy"><span className="tm-onboard-footer-dot" /><span>Change any choice later in Settings</span></div>
                  {error && <p className="tm-onboard-error" role="alert">{error}</p>}
                  <div className="tm-onboard-footer-actions">{step > 0 && <button type="button" className="tm-onboard-back" onClick={() => { setError(''); setStep(current => current - 1); }} disabled={loading}><ArrowLeft size={17} /> Back</button>}<button type="button" className="tm-onboard-next" onClick={step === STEPS.length - 1 ? finish : next} disabled={loading}>{loading ? 'Saving your space…' : step === STEPS.length - 1 ? 'Enter TimeMachine' : 'Continue'}{!loading && <ArrowRight size={18} />}</button></div>
                </footer>
              </div>
            </div>}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>}
    </AnimatePresence>
  </Dialog.Root>;
};

export default OnboardingModal;
