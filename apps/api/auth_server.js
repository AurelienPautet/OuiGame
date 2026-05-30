const { OAuth2Client } = require("google-auth-library");
const dotenv = require("dotenv");

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyToken(idToken) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    return {
      userId: payload["sub"],
      name: payload["name"],
      email: payload["email"],
    };
  } catch (error) {
    console.error("Error verifying ID token:", error);
    throw new Error("Invalid ID token");
  }
}

module.exports = {
  verifyToken,
};
