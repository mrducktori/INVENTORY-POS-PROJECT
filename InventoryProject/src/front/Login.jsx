import { useState } from 'react';
import '../styles/Login.css';
import App from './Dashboard';
import { loginUser, saveUser, getCurrentUser } from '../api/authApi.js';


function Login() {
  const [form, setForm] = useState({
    username: '',
    password: ''
  });

  const [user, setUser] = useState(getCurrentUser());

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
      const data = await loginUser(form.username, form.password);
      // save user
      saveUser(data);
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
      <form onSubmit={handleSubmit}>
        <h1>Login</h1>
        {error && <p className="error">{error}</p>}
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