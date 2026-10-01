import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'euevent-security-session';
const API_BASE_URL_KEY = 'euevent-api-base-url';

export const sessionStorage = {
  readToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  saveToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  readApiBaseUrl: () => SecureStore.getItemAsync(API_BASE_URL_KEY),
  saveApiBaseUrl: (url: string) => SecureStore.setItemAsync(API_BASE_URL_KEY, url),
};
