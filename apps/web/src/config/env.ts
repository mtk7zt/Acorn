/**
 * Environment & Demo Mode Configuration
 * Keeps the public web prototype safely in DEMO_MODE by default while allowing
 * clean connection to an authenticated Acorn API gateway in production.
 */
export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE !== "false";

export const ACORN_API_BASE_URL: string | undefined =
  import.meta.env.VITE_ACORN_API_BASE_URL;

export const ACCESS_WEBHOOK_URL: string | undefined =
  import.meta.env.VITE_ACCESS_WEBHOOK_URL;
