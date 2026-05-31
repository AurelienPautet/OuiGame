// google-auth-library is mocked so verifyToken is tested without real Google
// credentials or network. The shared verifyIdToken mock is created inside the
// (hoisted) factory and hung off the OAuth2Client constructor so the test can
// reach it after import — referencing an outer const from the factory would hit
// a temporal-dead-zone error because the import is hoisted above it.
jest.mock("google-auth-library", () => {
  const verifyIdToken = jest.fn();
  const OAuth2Client = jest.fn().mockImplementation(() => ({ verifyIdToken }));
  (OAuth2Client as unknown as { __verifyIdToken: jest.Mock }).__verifyIdToken =
    verifyIdToken;
  return { OAuth2Client };
});

import { OAuth2Client } from "google-auth-library";
import { verifyToken } from "../../auth_server";

const mockVerifyIdToken = (
  OAuth2Client as unknown as { __verifyIdToken: jest.Mock }
).__verifyIdToken;

describe("verifyToken", () => {
  test("maps a verified Google payload to { userId, name, email }", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-123",
        name: "Bob",
        email: "bob@example.com",
      }),
    });

    await expect(verifyToken("good-token")).resolves.toEqual({
      userId: "google-123",
      name: "Bob",
      email: "bob@example.com",
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ idToken: "good-token" })
    );
  });

  test("throws 'Invalid ID token' when verification rejects", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockVerifyIdToken.mockRejectedValue(new Error("signature mismatch"));

    await expect(verifyToken("bad-token")).rejects.toThrow("Invalid ID token");
  });
});
