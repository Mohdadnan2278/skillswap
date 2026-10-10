import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep project conventions stable; onboarding must not rewrite tracked instructions.
  agentRules: false,
  logging: { incomingRequests: false },
};
export default config;
