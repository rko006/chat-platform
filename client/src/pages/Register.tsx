import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// ✅ Moved outside to prevent re-render issues
function Field({
  label,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  form,
  setForm,
  errors,
  showPassword
}: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>

      <input
        type={
          name === 'password' || name === 'confirm'
            ? showPassword ? 'text' : 'password'
            : type
        }
        value={form[name]}
        onChange={(e) => {
          setForm((f: any) => ({ ...f, [name]: e.target.value }));
        }}
        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm ${
          errors[name]
            ? 'border-red-400 dark:border-red-600'
            : 'border-slate-200 dark:border-slate-600'
        }`}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />

      {errors[name] && (
        <p className="mt-1 text-xs text-red-500">{errors[name]}</p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const e: any = {};

    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'Minimum 3 characters';

    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';

    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';

    if (form.password !== form.confirm)
      e.confirm = 'Passwords do not match';

    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      await register(form.username, form.email, form.password);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed';

      if (msg.includes('email')) setErrors({ email: msg });
      else if (msg.includes('username')) setErrors({ username: msg });
      else setErrors({ general: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex justify-center py-10 px-4">

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-slate-800 shadow-md"
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            ChatFlow
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Create your account
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">

          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 text-red-600 rounded">
              {errors.general}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            className="space-y-4"
          >
            <Field
              label="Username"
              name="username"
              placeholder="yourname"
              autoComplete="off"
              form={form}
              setForm={setForm}
              errors={errors}
              showPassword={showPassword}
            />

            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="off"
              form={form}
              setForm={setForm}
              errors={errors}
              showPassword={showPassword}
            />

            {/* Password */}
            <Field
              label="Password"
              name="password"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              form={form}
              setForm={setForm}
              errors={errors}
              showPassword={showPassword}
            />

            {/* Confirm */}
            <Field
              label="Confirm Password"
              name="confirm"
              placeholder="Re-enter password"
              autoComplete="new-password"
              form={form}
              setForm={setForm}
              errors={errors}
              showPassword={showPassword}
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl"
            >
              {isLoading ? 'Creating...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}