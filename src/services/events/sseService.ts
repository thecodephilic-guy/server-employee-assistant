import { Response } from "express";

export interface SSEClient {
  id: string;
  userId?: string;
  companyId?: string;
  res: Response;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, res: Response, userId?: string, companyId?: string) {
    this.clients.set(id, { id, userId, companyId, res });
    console.log(` SSE client connected: ${id} (userId: ${userId || "anonymous"})`);

    // Send initial handshake
    this.sendToClient(id, "CONNECTED", { clientId: id, timestamp: new Date().toISOString() });
  }

  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`🔌 SSE client disconnected: ${id}`);
  }

  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.write(`event: ${event}\n`);
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        this.removeClient(clientId);
      }
    }
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        this.removeClient(id);
      }
    }
  }

  sendToUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          client.res.write(payload);
        } catch (err) {
          this.removeClient(id);
        }
      }
    }
  }

  sendToCompany(companyId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.companyId === companyId || !client.companyId) {
        try {
          client.res.write(payload);
        } catch (err) {
          this.removeClient(id);
        }
      }
    }
  }
}

export const sseService = new SSEService();
