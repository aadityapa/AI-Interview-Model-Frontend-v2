import { apiFetch, handleJson } from "../core.js";
import { authFieldsByRole } from "./sharedAuth.js";

export function createHrAuth(saveAuthSession, revealAppAfterAuth, setStatus) {
  async function registerHr() {
    const fields = authFieldsByRole("hr");
    try {
      setStatus("Creating HR account...");
      await handleJson(
        await apiFetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            full_name: fields.fullName,
            email: fields.email,
            username: fields.username || fields.email,
            password: fields.password,
            role: "hr",
          }),
        })
      );
      setStatus("HR registration successful. Now click Login.");
      return true;
    } catch (err) {
      setStatus(`Registration failed: ${err.message}`);
      return false;
    }
  }

  async function loginHr() {
    const fields = authFieldsByRole("hr");
    try {
      setStatus("Authenticating HR login...");
      const data = await handleJson(
        await apiFetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username: fields.email || fields.username,
            password: fields.password,
          }),
        })
      );
      const user = data.user || {};
      if ((user.role || "").toLowerCase() !== "hr") {
        throw new Error("This portal is only for HR users.");
      }
      const token = data.access_token || "";
      if (!token) throw new Error("Access token missing from server.");
      saveAuthSession(user, token, data.expires_at_ist || "");
      setStatus("Login successful as HR.");
      revealAppAfterAuth(user);
      return true;
    } catch (err) {
      setStatus(`Login failed: ${err.message}`);
      return false;
    }
  }

  return { registerHr, loginHr };
}
