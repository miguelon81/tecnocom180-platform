const API_URL = import.meta.env.VITE_API_URL

export interface LoginResponse {
  token: string
  user: {
    id: string
    organizationId: string
    name: string
    email: string
    phone: string | null
    role: string
  }
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)

    throw new Error(
      data?.error ?? `Error al iniciar sesión: ${response.status}`,
    )
  }

  return response.json()
}