import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function Login() {
  const navigate = useNavigate();
  const { login, logout, isAuthenticated, user, role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const result = await login(email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate("/", { replace: true });
  };

  if (isAuthenticated) {
    return (
      <div style={{ padding: "32px" }}>
        <h1>Login</h1>
        <p>
          You are logged in as <strong>{user.email}</strong> ({role}).
        </p>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        {error && <div style={{ color: "crimson" }}>{error}</div>}
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
