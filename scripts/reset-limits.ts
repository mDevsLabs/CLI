import { Client } from 'pg'

async function resetLimits() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    await client.connect()
    console.log('🔌 Successfully connected to the database!')

    // Generic query to reset usage limits to 0%
    const res = await client.query(`
      UPDATE users 
      SET limit_utilization = 0, 
          used_credits = 0,
          usage_percentage = 0;
    `)

    console.log(
      `✅ Incredible! Limits for ${res.rowCount} users have been reset to 0%! 🚀`,
    )
  } catch (error) {
    console.error('❌ An error occurred during reset:', error)
  } finally {
    await client.end()
    console.log('🔒 Disconnected from database.')
  }
}

resetLimits()
