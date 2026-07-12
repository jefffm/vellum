import type { RequestHandler } from "express";
import { ApiRouteError } from "./create-route.js";
import { ProviderConnection } from "./provider-connection.js";

export function createProviderStatusRoute(connection: ProviderConnection): RequestHandler {
  return async (_request, response, next) => {
    try {
      response.json({ ok: true, data: await connection.status() });
    } catch (error) {
      next(error);
    }
  };
}

export function createProviderLoginRoute(connection: ProviderConnection): RequestHandler {
  return async (_request, response, next) => {
    try {
      response.json({ ok: true, data: await connection.beginLogin() });
    } catch (error) {
      next(error);
    }
  };
}

export function createProviderPromptRoute(connection: ProviderConnection): RequestHandler {
  return (request, response, next) => {
    try {
      if (typeof request.body?.value !== "string") {
        throw new ApiRouteError("value must be a string", 400, "invalid_request");
      }
      connection.submitPrompt(request.body.value);
      response.json({ ok: true, data: { accepted: true } });
    } catch (error) {
      next(error);
    }
  };
}

export function createProviderDisconnectRoute(connection: ProviderConnection): RequestHandler {
  return async (_request, response, next) => {
    try {
      await connection.disconnect();
      response.json({ ok: true, data: await connection.status() });
    } catch (error) {
      next(error);
    }
  };
}

export function createProviderReconnectRoute(connection: ProviderConnection): RequestHandler {
  return async (_request, response, next) => {
    try {
      response.json({ ok: true, data: await connection.reconnect() });
    } catch (error) {
      next(error);
    }
  };
}
