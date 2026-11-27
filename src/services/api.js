
export const API_BASE_URL = 'http://127.0.0.1:8000'

// Add the logged-in user's JWT to protected API requests.
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('access_token')
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  })
}
