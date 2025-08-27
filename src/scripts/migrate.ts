import { dbService } from '../services/database/database.service';

const createTables = async () => {
  console.log('Starting database migration...');

  try {
    // Users table
    await dbService.query(`
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
    `);

    // Create indexes for better performance
    await dbService.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await dbService.query(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);`);

    // Add google_id column if it doesn't exist (for existing tables)
    try {
      await dbService.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;`);
      await dbService.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`);
    } catch (error) {
      console.log('Note: google_id column may already exist or password constraint already modified');
    }

    // Add usage reset tracking columns if they don't exist
    try {
      await dbService.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_usage_reset TIMESTAMP DEFAULT NOW();`);
      await dbService.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMP DEFAULT NOW();`);

      // Update default monthly_limit for existing users
      await dbService.query(`ALTER TABLE users ALTER COLUMN monthly_limit SET DEFAULT 100;`);
      await dbService.query(`UPDATE users SET monthly_limit = 100 WHERE monthly_limit = 5;`);
    } catch (error) {
      console.log('Note: Usage reset columns may already exist or monthly_limit already updated');
    }

    await dbService.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);

    // Fix any existing users with NULL is_active values
    try {
      const fixResult = await dbService.query(`
        UPDATE users
        SET is_active = true
        WHERE is_active IS NULL
      `);
      if (fixResult && fixResult.rowCount && fixResult.rowCount > 0) {
        console.log(`Fixed ${fixResult.rowCount} users with NULL is_active values`);
      }
    } catch (error: any) {
      console.log('Note: Could not update NULL is_active values (column might not exist yet):', error?.message || 'Unknown error');
    }

    // Fix specific user by email (from the logs)
    try {
      const specificUserResult = await dbService.query(`
        UPDATE users
        SET is_active = true
        WHERE email = 'tarcode33@gmail.com' AND (is_active IS NULL OR is_active = false)
      `);
      if (specificUserResult && specificUserResult.rowCount && specificUserResult.rowCount > 0) {
        console.log(`Fixed specific user tarcode33@gmail.com - updated ${specificUserResult.rowCount} row(s)`);
      }
    } catch (error: any) {
      console.log('Note: Could not update specific user:', error?.message || 'Unknown error');
    }

    // Create updated_at trigger function
    await dbService.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for updated_at
    await dbService.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

const dropTables = async () => {
  console.log('Dropping all tables...');

  try {
    await dbService.query('DROP TABLE IF EXISTS users CASCADE;');
    await dbService.query('DROP FUNCTION IF EXISTS update_updated_at_column();');

    console.log('✅ All tables dropped successfully!');
  } catch (error) {
    console.error('❌ Failed to drop tables:', error);
    throw error;
  }
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
