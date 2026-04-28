import { useState } from 'react';
import { loginUser, saveUser, getCurrentUser } from '../../api/authApi.js';

export const useLogin = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [user, setUser] = useState(getCurrentUser());
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false); 
  const [isMenuZoomed, setIsMenuZoomed] = useState(false);

  const toggleModal = () => setFormOpen(!formOpen);
  const toggleZoom = () => setIsMenuZoomed(!isMenuZoomed);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await loginUser(form.username, form.password);
      saveUser(data);
      setUser(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return {
    form,
    user,
    error,
    formOpen,
    isMenuZoomed,
    toggleModal,
    toggleZoom,
    handleChange,
    handleSubmit
  };
};
