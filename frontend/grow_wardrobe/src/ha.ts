import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService,
  type Connection,
  type HassEntities,
} from 'home-assistant-js-websocket';

const STORAGE_KEY_TOKEN = 'ha_llat_token';
const STORAGE_KEY_URL = 'ha_base_url';

export function getDefaultHaUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.port === '8123' || window.location.pathname.startsWith('/local/')) {
      return window.location.origin;
    }
  }
  return 'http://homeassistant.local:8123';
}

export function getStoredHaConfig(): { url: string; token: string } {
  const url = localStorage.getItem(STORAGE_KEY_URL) || getDefaultHaUrl();
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
  return { url, token };
}

export function saveHaConfig(url: string, token: string): void {
  localStorage.setItem(STORAGE_KEY_URL, url.trim().replace(/\/+$/, ''));
  localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
}

/**
 * Automatically discovers the Home Assistant connection:
 * 1. If embedded inside HA (Webpage Dashboard), reuses the parent window's active connection.
 *    No tokens or login prompts needed on any device!
 * 2. If running standalone / dev server, uses the stored Long-Lived Access Token.
 */
export async function getHaConnection(
  onEntities: (entities: HassEntities) => void,
  onDisconnect?: () => void
): Promise<{ connection: Connection; isEmbedded: boolean }> {
  // 1. Try to borrow connection from parent window if inside HA
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      const parentWin = window.parent as any;
      if (parentWin.hassConnection) {
        const { conn } = await parentWin.hassConnection;
        subscribeEntities(conn, onEntities);
        if (onDisconnect) conn.addEventListener('disconnected', onDisconnect);
        return { connection: conn, isEmbedded: true };
      }

      const haElem = parentWin.document?.querySelector('home-assistant') as any;
      if (haElem?.hass?.connection) {
        const conn = haElem.hass.connection;
        subscribeEntities(conn, onEntities);
        if (onDisconnect) conn.addEventListener('disconnected', onDisconnect);
        return { connection: conn, isEmbedded: true };
      }
    } catch (err) {
      console.warn('Could not access parent HA window:', err);
    }
  }

  // 2. Fallback: Use stored Long-Lived Access Token (e.g. for dev server on localhost:5173)
  const { url, token } = getStoredHaConfig();
  if (token) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const auth = createLongLivedTokenAuth(cleanUrl, token);
    const conn = await createConnection({ auth });
    if (onDisconnect) conn.addEventListener('disconnected', onDisconnect);
    subscribeEntities(conn, onEntities);
    return { connection: conn, isEmbedded: false };
  }

  throw new Error('AUTH_REQUIRED');
}

export async function sendMqttCommand(
  conn: Connection,
  topic: string,
  payload: string,
  retain = false
): Promise<void> {
  await callService(conn, 'mqtt', 'publish', {
    topic,
    payload,
    retain,
  });
}

export async function setEntityState(
  conn: Connection,
  domain: string,
  service: string,
  entityId: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  await callService(conn, domain, service, {
    entity_id: entityId,
    ...data,
  });
}

export function subscribeMqttTopic(
  conn: Connection,
  topic: string,
  callback: (message: { topic: string; payload: string }) => void
): Promise<() => Promise<void>> {
  return conn.subscribeMessage<{ topic: string; payload: string }>(
    (msg) => callback(msg),
    {
      type: 'mqtt/subscribe',
      topic,
    }
  );
}

export interface HaHistoryState {
  s?: string;
  state?: string;
  lu?: number;
  last_changed?: string;
  last_updated?: string;
}

export type HaHistoryResponse = Record<string, HaHistoryState[]>;

export async function fetchSensorHistory(
  conn: Connection,
  entityIds: string[],
  startTime: Date,
  endTime?: Date
): Promise<HaHistoryResponse> {
  if (!conn || typeof conn.sendMessagePromise !== 'function') {
    return {};
  }
  return conn.sendMessagePromise<HaHistoryResponse>({
    type: 'history/history_during_period',
    start_time: startTime.toISOString(),
    end_time: endTime ? endTime.toISOString() : undefined,
    entity_ids: entityIds,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
}
