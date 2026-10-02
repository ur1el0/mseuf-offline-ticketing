import * as SecureStore from 'expo-secure-store';
import type { User } from './auth';

const TOKEN_KEY = 'euevent-security-session';
const API_BASE_URL_KEY = 'euevent-api-base-url';
const USER_KEY = 'euevent-security-user';

export const sessionStorage = {
  readToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  saveToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  readUser: async (): Promise<User | null> => {
    const savedUser = await SecureStore.getItemAsync(USER_KEY);

    if (!savedUser) {
      return null;
    }

    try {
      const user = JSON.parse(savedUser) as User;
      return Number.isInteger(user.id)
        && typeof user.name === 'string'
        && (typeof user.student_number === 'string' || user.student_number === null)
        && typeof user.role === 'string'
        ? user
        : null;
    } catch {
      return null;
    }
  },
  saveUser: (user: User) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  clearUser: () => SecureStore.deleteItemAsync(USER_KEY),
  readApiBaseUrl: () => SecureStore.getItemAsync(API_BASE_URL_KEY),
  saveApiBaseUrl: (url: string) => SecureStore.setItemAsync(API_BASE_URL_KEY, url),
};
