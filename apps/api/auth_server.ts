import { OAuth2Client } from "google-auth-library";
import { HttpError } from "./errors";

// GOOGLE_CLIENT_ID is loaded from the repo-root .env by env.ts (the first import
// in every entrypoint) on local dev, and from real config vars on Heroku.
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyToken(idToken: string) {
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new HttpError(400, {
      error: "id_token_required",
      message: "Missing Google credential",
    });
  }

  // Pin the audience to our client ID so a token minted for any other Google
  // app is rejected. Fail CLOSED if it's unset: verifying without an audience
  // would accept any validly-signed Google token (confused-deputy auth bypass),
  // so a misconfigured server must refuse sign-in rather than trust everything.
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (audience === undefined || audience === "") {
    console.error("GOOGLE_CLIENT_ID is not set — refusing Google sign-in.");
    throw new HttpError(500, {
      error: "auth_unconfigured",
      message: "Google sign-in is not configured",
    });
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience });
  } catch (error) {
    // A malformed/expired token or an audience mismatch is a client error, not
    // a server fault — map it to 401 instead of letting it bubble to a generic
    // 500 (which left the web client's login modal stuck open with no message).
    console.error("Error verifying Google ID token:", error);
    throw new HttpError(401, {
      error: "invalid_token",
      message: "Could not verify Google sign-in",
    });
  }

  const payload = ticket.getPayload();
  if (payload === undefined) {
    throw new HttpError(401, {
      error: "invalid_token",
      message: "Could not verify Google sign-in",
    });
  }

  return {
    userId: payload.sub,
    name: payload.name,
    email: payload.email,
  };
}

export { verifyToken };
