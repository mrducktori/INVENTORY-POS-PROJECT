import { useState } from 'react';
import '../CSS/Login.css';
import App from './Dashboard_test';


function Login() {
  const [form, setForm] = useState({
    username: '',
    password: ''
  });

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user"))
  );

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // save user
      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);

    } catch (err) {
      setError(err.message);
    }
  };

  if (user) {
    return <App />;
  }

  return (
    <div className="login-container">
      <h2>Login</h2>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Username:</label>
        <input
          type="text"
          name="username"
          value={form.username}
          onChange={handleChange}
          required
        />

        <label>Password:</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;