import { dbService } from '../services/database.service';

const safeQuery = async (sql: string, description?: string) => {
  try {
    const result = await dbService.query(sql);
    console.log(`Query successful${description ? `: ${description}` : ''}`);
    console.log('Result rows:', result?.rows?.length || 0);
    return result;
  } catch (err: any) {
    console.error(`Query failed${description ? `: ${description}` : ''}`, err?.message || err);
    return null;
  }
};

const createTables = async () => {
  console.log('Starting database migration...');

  // Users table
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      google_id VARCHAR(255) UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      company_name VARCHAR(255),
      role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business', 'enterprise')),
      monthly_limit INTEGER DEFAULT 100,
      usage_count INTEGER DEFAULT 0,
      last_usage_reset TIMESTAMP DEFAULT NOW(),
      billing_period_start TIMESTAMP DEFAULT NOW(),
      is_active BOOLEAN DEFAULT true,
      email_verified BOOLEAN DEFAULT false,
      email_verification_token VARCHAR(255),
      password_reset_token VARCHAR(255),
      password_reset_expires TIMESTAMP,
      stripe_customer_id VARCHAR(255),
      subscription_id VARCHAR(255),
      subscription_status VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `, 'Create users table');

  await safeQuery(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`, 'Index email');
  await safeQuery(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);`, 'Index is_active');

  // Add google_id column if it doesn't exist
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;`, 'Add google_id');
  await safeQuery(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`, 'Alter password');

  // Usage reset columns
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_usage_reset TIMESTAMP DEFAULT NOW();`, 'Add last_usage_reset');
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMP DEFAULT NOW();`, 'Add billing_period_start');

  await safeQuery(`ALTER TABLE users ALTER COLUMN monthly_limit SET DEFAULT 100;`, 'Set default monthly_limit');
  await safeQuery(`UPDATE users SET monthly_limit = 100 WHERE monthly_limit = 5;`, 'Update existing monthly_limit');

  await safeQuery(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`, 'Index google_id');

  // Fix NULL is_active
  const fixResult = await safeQuery(`
    UPDATE users
    SET is_active = true
    WHERE is_active IS NULL
  `, 'Fix NULL is_active');
  if (fixResult?.rowCount) {
    console.log(`Fixed ${fixResult.rowCount} users with NULL is_active values`);
  }

  // Fix specific user
  const specificUserResult = await safeQuery(`
    UPDATE users
    SET is_active = true
    WHERE email = 'tarcode33@gmail.com' AND (is_active IS NULL OR is_active = false)
  `, 'Fix specific user');
  if (specificUserResult?.rowCount) {
    console.log(`Fixed specific user tarcode33@gmail.com - updated ${specificUserResult.rowCount} row(s)`);
  }

  // Updated_at trigger
  await safeQuery(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `, 'Create trigger function');

  await safeQuery(`
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, 'Create updated_at trigger');

  console.log('✅ Database migration completed successfully!');
};

const dropTables = async () => {
  console.log('Dropping all tables...');
  await safeQuery('DROP TABLE IF EXISTS users CASCADE;', 'Drop users table');
  await safeQuery('DROP FUNCTION IF EXISTS update_updated_at_column();', 'Drop trigger function');
  console.log('✅ All tables dropped successfully!');
};

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'down') {
    dropTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    createTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

export { createTables, dropTables };
