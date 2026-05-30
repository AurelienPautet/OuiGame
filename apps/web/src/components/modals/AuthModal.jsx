import { useState, useEffect, useRef } from "react";
import { useModal, useAuth } from "../../contexts";
import { Tab, TabList } from "../ui";

const GOOGLE_CLIENT_ID =
  "403445313450-kvueoci8r29rcpqk2p8jle1escfn6cc9.apps.googleusercontent.com";

export const AuthModal = () => {
  const { closeModal } = useModal();
  const {
    login,
    register,
    googleLogin,
    submitGoogleUsername,
    authError,
    clearAuthError,
    needsGoogleUsername,
    user,
  } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [googleUsername, setGoogleUsername] = useState("");
  const googleButtonRef = useRef(null);

  // Close modal when user is authenticated
  useEffect(() => {
    if (user) {
      closeModal();
    }
  }, [user, closeModal]);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (typeof google !== "undefined" && googleButtonRef.current) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });

      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: isLogin ? "signin_with" : "signup_with",
        locale: "en",
        width: "100%",
      });
    }
  }, [isLogin]);

  const handleCredentialResponse = (response) => {
    googleLogin(response.credential, "");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      login(formData.email, formData.password);
    } else {
      register(formData.username, formData.email, formData.password);
    }
  };

  const handleGoogleUsernameSubmit = (e) => {
    e.preventDefault();
    if (googleUsername.trim()) {
      submitGoogleUsername(googleUsername.trim());
    }
  };

  const handleChange = (e) => {
    clearAuthError();
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleTabChange = (loginTab) => {
    setIsLogin(loginTab);
    clearAuthError();
  };

  const getFieldError = (fieldName) => {
    if (authError && authError.field === fieldName) {
      return authError.message;
    }
    return null;
  };

  // Show username input for new Google users
  if (needsGoogleUsername) {
    return (
      <dialog className="modal modal-open">
        <div className="modal-box p-0 overflow-hidden">
          <div className="bg-primary text-primary-content p-4">
            <h3 className="font-bold text-lg">Choose a Username</h3>
          </div>
          <div className="bg-base-100 p-6">
            <p className="mb-4 text-base-content/70">
              Welcome! Please choose a username for your new account.
            </p>
            <form onSubmit={handleGoogleUsernameSubmit}>
              <fieldset className="fieldset mb-4">
                <legend className="fieldset-legend">Username</legend>
                <input
                  type="text"
                  className={`input input-bordered w-full bg-base-200 ${
                    getFieldError("username") ? "input-error" : ""
                  }`}
                  placeholder="Enter username"
                  value={googleUsername}
                  onChange={(e) => {
                    clearAuthError();
                    setGoogleUsername(e.target.value);
                  }}
                  required
                  autoFocus
                />
                {getFieldError("username") && (
                  <span className="text-error text-sm mt-1">
                    {getFieldError("username")}
                  </span>
                )}
              </fieldset>

              <div className="flex justify-center gap-4 mt-6">
                <button type="button" className="btn" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeModal}>close</button>
        </form>
      </dialog>
    );
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box p-0 overflow-hidden">
        {/* Custom Tabs */}
        <div className="pb-0">
          <TabList>
            <Tab active={isLogin} onClick={() => handleTabChange(true)} first>
              Login
            </Tab>
            <Tab active={!isLogin} onClick={() => handleTabChange(false)}>
              Register
            </Tab>
          </TabList>
        </div>

        {/* Form content */}
        <div className="bg-base-100 p-6">
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <fieldset className="fieldset mb-4">
                <legend className="fieldset-legend">Username</legend>
                <input
                  type="text"
                  name="username"
                  className={`input input-bordered w-full bg-base-200 ${
                    getFieldError("username") ? "input-error" : ""
                  }`}
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleChange}
                  required={!isLogin}
                />
                {getFieldError("username") && (
                  <span className="text-error text-sm mt-1">
                    {getFieldError("username")}
                  </span>
                )}
              </fieldset>
            )}

            <fieldset className="fieldset mb-4">
              <legend className="fieldset-legend">Email</legend>
              <input
                type="email"
                name="email"
                className={`input input-bordered w-full bg-base-200 ${
                  getFieldError("email") ? "input-error" : ""
                }`}
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              {getFieldError("email") && (
                <span className="text-error text-sm mt-1">
                  {getFieldError("email")}
                </span>
              )}
            </fieldset>

            <fieldset className="fieldset mb-4">
              <legend className="fieldset-legend">Password</legend>
              <input
                type="password"
                name="password"
                className={`input input-bordered w-full bg-base-200 ${
                  getFieldError("password") ? "input-error" : ""
                }`}
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              {getFieldError("password") && (
                <span className="text-error text-sm mt-1">
                  {getFieldError("password")}
                </span>
              )}
            </fieldset>

            <div className="flex justify-center gap-4 mt-6">
              <button type="button" className="btn" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {isLogin ? "Login" : "Register"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="divider my-4">OR</div>

          {/* Google Sign-In Button */}
          <div className="flex justify-center">
            <div ref={googleButtonRef}></div>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={closeModal}>close</button>
      </form>
    </dialog>
  );
};
