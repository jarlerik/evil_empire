import { useEffect, useRef, useCallback } from 'react';
import { useDashboardDispatch, dispatchDashboardEvent } from '../context/DashboardContext';
import type { DashboardEvent, PlaybackCommand } from '../../types';

export function useWebSocket() {
  const dispatch = useDashboardDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(proto + '//' + location.host + '/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      dispatch({ type: 'WS_CONNECTED' });
    };

    ws.onclose = () => {
      dispatch({ type: 'WS_DISCONNECTED' });
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 10000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (evt) => {
      let data: DashboardEvent;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      dispatchDashboardEvent(dispatch, data);
    };
  }, [dispatch]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendPlayback = useCallback((action: PlaybackCommand['action'], speed?: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: PlaybackCommand = { type: 'playback', action };
    if (speed !== undefined) msg.speed = speed;
    ws.send(JSON.stringify(msg));
  }, []);

  return { sendPlayback };
}
