import { Hono } from 'hono'
import { createHash } from 'node:crypto'
import { storeCreateUser, storeGetUser, storeGetUserByEmail } from '../../store'
import { issueToken } from '../../auth/token'

const app = new Hono()

/** Simple SHA-256 password hash (no external deps). */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * POST /web/users/register
 * Body: { username, email, phone?, password }
 * Returns: { token, expires_in, username }
 */
app.post('/register', async c => {
  const { username, email, phone, password } = await c.req.json()

  if (!username || typeof username !== 'string') {
    return c.json({ error: 'username is required' }, 400)
  }
  if (!email || typeof email !== 'string') {
    return c.json({ error: 'email is required' }, 400)
  }
  if (!password || typeof password !== 'string') {
    return c.json({ error: 'password is required' }, 400)
  }

  // Check username uniqueness
  if (storeGetUser(username)) {
    return c.json({ error: 'Username already taken' }, 409)
  }

  // Check email uniqueness
  if (storeGetUserByEmail(email)) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = hashPassword(password)
  storeCreateUser(username, {
    email,
    phone: phone ?? null,
    passwordHash,
  })

  const { token, expires_in } = issueToken(username)
  return c.json({ token, expires_in, username }, 201)
})

/**
 * POST /web/users/login
 * Body: { username?, email?, password, currentPassword? }
 * Returns: { token, expires_in, username }
 */
app.post('/login', async c => {
  const { username, email, password, currentPassword } = await c.req.json()

  // Accept either "password" or "currentPassword" for flexibility
  const rawPassword = password ?? currentPassword
  if (!rawPassword || typeof rawPassword !== 'string') {
    return c.json({ error: 'password is required' }, 400)
  }

  let user = username ? storeGetUser(username as string) : undefined
  if (!user && email) {
    user = storeGetUserByEmail(email as string)
  }

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  if (!user.passwordHash) {
    return c.json({ error: 'Account has no password set' }, 401)
  }

  if (user.passwordHash !== hashPassword(rawPassword)) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const { token, expires_in } = issueToken(user.username)
  return c.json({
    token,
    expires_in,
    username: user.username,
    email: user.email,
    phone: user.phone,
  })
})

export default app
