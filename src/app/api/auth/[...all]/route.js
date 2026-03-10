import { toNextJsHandler } from "better-auth/next-js";
import { auth, ensureAuthSetup } from "../../../../lib/auth";

const handler = toNextJsHandler(async (request) => {
  await ensureAuthSetup();
  return auth.handler(request);
});

export const { GET, POST, PATCH, PUT, DELETE } = handler;
