import { useCallback, useEffect, useRef, useState } from 'react';
import { isWorkExecuting, type WorkCapabilities, type WorkRequest, type WorkSnapshot, type WorkTask } from '../../shared/work';
import { getWorkCapabilities, getWorkSnapshot, listWorkTasks, mutateWork } from '../services/work/workService';

export function useWork(sessionId: string, identity: string | null, visible: boolean) {
  const [capabilities, setCapabilities] = useState<WorkCapabilities | null>(null);
  const [snapshot, setSnapshot] = useState<WorkSnapshot | null>(null);
  const [history, setHistory] = useState<WorkTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  useEffect(() => {
    const abort = new AbortController();
    queueMicrotask(() => { if (!abort.signal.aborted) setChecking(true); });
    getWorkCapabilities(abort.signal).then(async capabilities => {
      if (abort.signal.aborted) return;
      setCapabilities(capabilities);
      if (capabilities.access !== 'allowed') return;
      const tasks = await listWorkTasks(abort.signal);
      if (abort.signal.aborted) return;
      setHistory(tasks);
      const current = tasks.find(task => task.session_id === sessionId);
      if (current) {
        selectedRef.current = current.id;
        const result = await getWorkSnapshot(current.id, abort.signal);
        if (!abort.signal.aborted) setSnapshot(result);
      }
    }).catch(cause => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Work could not connect.');
    }).finally(() => { if (!abort.signal.aborted) setChecking(false); });
    return () => abort.abort();
  }, [sessionId, identity]);
  const taskId = snapshot?.task.id;
  const status = snapshot?.task.status;
  useEffect(() => {
    if (!taskId || !status || !isWorkExecuting(status) || !visible) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await getWorkSnapshot(taskId, abort.signal);
        if (!abort.signal.aborted && selectedRef.current === taskId) {
          setSnapshot(previous => !previous || previous.task.revision <= result.task.revision ? result : previous);
          setError(null);
        }
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Progress could not reconnect.');
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 2500);
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [taskId, status, visible]);
  const select = useCallback(async (taskId: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    selectedRef.current = taskId;
    try {
      const result = await getWorkSnapshot(taskId);
      if (aliveRef.current && selectedRef.current === taskId) setSnapshot(result);
    } catch (cause) { if (aliveRef.current) setError(cause instanceof Error ? cause.message : 'Task could not open.'); }
    finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  }, []);
  const mutate = useCallback(async (request: WorkRequest): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const result = await mutateWork(request);
      if (aliveRef.current) {
        selectedRef.current = result.task.id;
        setSnapshot(result);
        setHistory(previous => [result.task, ...previous.filter(task => task.id !== result.task.id)].slice(0, 30));
      }
      return true;
    } catch (cause) {
      if (aliveRef.current) setError(cause instanceof Error ? cause.message : 'Work could not complete this request.');
      // A lost POST response may still have created/updated a durable task.
      const id = request.action === 'create' ? request.requestId : request.taskId;
      try {
        const saved = await getWorkSnapshot(id);
        if (aliveRef.current) { selectedRef.current = id; setSnapshot(saved); }
      } catch { /* Keep the user's draft and the last known task on failure. */ }
      return false;
    } finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  }, []);
  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await getWorkCapabilities();
      if (!aliveRef.current) return;
      setCapabilities(next);
      if (next.access === 'allowed') {
        const tasks = await listWorkTasks();
        if (aliveRef.current) setHistory(tasks);
        if (selectedRef.current) await select(selectedRef.current);
      }
    } catch (cause) { if (aliveRef.current) setError(cause instanceof Error ? cause.message : 'Work could not reconnect.'); }
  }, [select]);
  const clear = useCallback(() => { selectedRef.current = null; setSnapshot(null); setError(null); }, []);
  return { capabilities, checking, snapshot, history, busy, error, setError, select, mutate, refresh, clear };
}
