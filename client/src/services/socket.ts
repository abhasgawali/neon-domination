import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../../../shared/types";

// Connect to the backend URL (Port 3000 as defined in server/index.ts)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true, // Auto-connect on import
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});