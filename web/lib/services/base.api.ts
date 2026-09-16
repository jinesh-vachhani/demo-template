import { useAuthStore } from '@/lib/auth-store';

const baseUrl =
  process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:4000';

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

export const baseAPI = async (url: string, method: any, body?: unknown) => {
  try {
    const token = useAuthStore.getState().token;

    const res = await fetch(`${baseUrl}/user${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Sends the httpOnly auth cookie set by the backend on same-site/CORS
      // requests; the Authorization header above covers non-cookie clients.
      credentials: 'include',
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('Invalid JSON response from server');
    }

    const responseData = data as Partial<ApiResponse> | null;

    if (!res.ok) {
      throw new Error(responseData?.message || `Request failed with status ${res.status}`);
    }
    return {
      success: true,
      message: responseData?.message ?? 'Request successful',
      data: responseData?.data ?? responseData,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';

    return {
      success: false,
      message,
    };
  }
};
