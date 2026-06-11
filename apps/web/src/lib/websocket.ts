export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly url: string) {}

  connect(token: string, onMessage: (data: any) => void) {
    if (this.socket) return;

    this.socket = new WebSocket(`${this.url}?token=${token}`);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket event payload:', err);
      }
    };

    this.socket.onclose = () => {
      console.warn('WebSocket connection dropped. Reconnecting...');
      this.socket = null;
      this.reconnectTimeout = setTimeout(() => this.connect(token, onMessage), 5000);
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket connection error:', err);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
