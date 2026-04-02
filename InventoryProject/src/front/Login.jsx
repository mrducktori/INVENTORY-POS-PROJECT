import { useState } from 'react';
import '../CSS/Login.css';
import App from './Dashboard_test';

function Login() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const clearLogin = () => {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsLoggedIn(true);
    clearLogin();
  };

  if (isLoggedIn) {
    return <App /> ;
  }


  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="username">Username:</label>
        <input type="text" id="username" name="username" required />
        <br />

        <label htmlFor="password">Password:</label>
        <input type="password" id="password" name="password" required />
        <br />

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;