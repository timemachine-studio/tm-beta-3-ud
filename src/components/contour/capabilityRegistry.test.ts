import { describe, expect, it } from 'vitest';
import { CONTOUR_CAPABILITIES, contourCapabilityForTool, contourNeedleTools } from './capabilityRegistry';
import { CONTOUR_COMMANDS } from './modules/commands';

describe('Contour capability registry', () => {
  it('gives every visible command one stable, unique capability contract', () => {
    expect(CONTOUR_CAPABILITIES).toHaveLength(CONTOUR_COMMANDS.length);
    expect(new Set(CONTOUR_CAPABILITIES.map(item => item.id)).size).toBe(CONTOUR_CAPABILITIES.length);
    expect(new Set(contourNeedleTools().map(item => item.name)).size).toBe(CONTOUR_CAPABILITIES.length + 1);
    expect(contourNeedleTools().some(item => item.name === 'contour__pass_to_chat')).toBe(true);
    for (const capability of CONTOUR_CAPABILITIES) {
      expect(contourCapabilityForTool(capability.tool.name)).toBe(capability);
      expect(capability.tool.parameters).toMatchObject({ type: 'object' });
    }
  });

  it('marks actions by side-effect level instead of trusting the interpreter', () => {
    const byCommand = new Map(CONTOUR_CAPABILITIES.map(item => [item.commandId, item]));
    expect(byCommand.get('calculator')?.effect).toBe('pure');
    expect(byCommand.get('convert-currency')?.effect).toBe('read');
    expect(byCommand.get('quick-note')?.effect).toBe('local-write');
    expect(byCommand.get('quick-event')?.effect).toBe('local-write');
    expect(byCommand.get('timer')).toMatchObject({
      id: 'tm.timer.start',
      version: 1,
      runtime: 'browser',
      persistence: 'device',
      background: 'while-open',
    });
    expect(byCommand.get('timer')?.tool.name).toBe('timer_start');
  });
});
