/**
 * Secure logging utility for COVENANT MCP Server.
 * Provides structured logging without leaking sensitive information.
 */
import pino from "pino";

// Redact sensitive fields from logs
const redact = {
  paths: ["privateKey", "secret", "password", "token", "authorization", "auth"],
  redact: "*".repeat(8),
};

// Create logger instance
export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact,
});

// Export logger methods
export const info = (msg: string, obj?: Record<string, unknown>) => {
  pinoLogger.info(obj ? { msg, ...obj } : msg);
};

export const error = (msg: string, obj?: Record<string, unknown>) => {
  pinoLogger.error(obj ? { msg, ...obj } : msg);
};

export const warn = (msg: string, obj?: Record<string, unknown>) => {
  pinoLogger.warn(obj ? { msg, ...obj } : msg);
};

export const debug = (msg: string, obj?: Record<string, unknown>) => {
  if (process.env.LOG_LEVEL === "debug") {
    pinoLogger.debug(obj ? { msg, ...obj } : msg);
  }
};