import axios, { AxiosInstance, AxiosError } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor with token refresh ─────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        isRefreshing = false;
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Don't show toast for auth errors (handled by contexts)
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      const message = (error.response?.data as any)?.error || 'Something went wrong';
      if (error.response?.status && error.response.status >= 500) {
        toast.error(message);
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

// ─── Auth API ────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateFcmToken: (fcmToken: string) => api.patch('/auth/fcm-token', { fcmToken }),
};

// ─── Chat API ────────────────────────────────────────────────────────────────
export const chatAPI = {
  getConversations: (page = 1) => api.get('/chats', { params: { page } }),
  createDirect: (targetUserId: string) => api.post('/chats/direct', { targetUserId }),
  createGroup: (data: { name: string; memberIds: string[]; description?: string }) =>
    api.post('/chats/group', data),
  getConversation: (id: string) => api.get(`/chats/${id}`),
  togglePin: (id: string) => api.patch(`/chats/${id}/pin`),
  toggleArchive: (id: string) => api.patch(`/chats/${id}/archive`),
  addMembers: (id: string, memberIds: string[]) =>
    api.post(`/chats/${id}/members`, { memberIds }),
  leaveGroup: (id: string) => api.delete(`/chats/${id}/leave`),
};

// ─── Message API ─────────────────────────────────────────────────────────────
export const messageAPI = {
  getMessages: (conversationId: string, before?: string) =>
    api.get(`/messages/${conversationId}`, { params: { before } }),
  send: (data: {
    conversationId: string;
    text?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
    mediaName?: string;
    replyTo?: string;
  }) => api.post('/messages/send', data),
  edit: (messageId: string, text: string) =>
    api.patch(`/messages/${messageId}`, { text }),
  delete: (messageId: string, deleteFor: 'me' | 'everyone') =>
    api.delete(`/messages/${messageId}`, { data: { deleteFor } }),
  react: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/react`, { emoji }),
  forward: (messageId: string, targetConversationIds: string[]) =>
    api.post(`/messages/${messageId}/forward`, { targetConversationIds }),
  search: (q: string, conversationId?: string) =>
    api.get('/messages/search', { params: { q, conversationId } }),
  markSeen: (conversationId: string) =>
    api.post(`/messages/conversations/${conversationId}/seen`),
  togglePin: (messageId: string) => api.patch(`/messages/${messageId}/pin`),
};

// ─── User API ────────────────────────────────────────────────────────────────
export const userAPI = {
  search: (q: string) => api.get('/users/search', { params: { q } }),
  getById: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (data: { username?: string; bio?: string; profilePicture?: string }) =>
    api.patch('/users/me/profile', data),
  updateNotifications: (settings: { messages: boolean; sounds: boolean; preview: boolean }) =>
    api.patch('/users/me/notifications', settings),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/users/me/password', data),
  toggleBlock: (targetUserId: string) => api.patch(`/users/${targetUserId}/block`),
};

// ─── Media API ───────────────────────────────────────────────────────────────
export const mediaAPI = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  delete: (mediaUrl: string) => api.delete('/media/delete', { data: { mediaUrl } }),
};

export default api;
