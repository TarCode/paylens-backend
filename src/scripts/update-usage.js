#!/usr/bin/env node

// Script to update usage count for a specific user
// Usage: node update-usage.js <email> <new_usage_count>

const { Client } = require('pg');
require('dotenv').config();

async function updateUsageCount(email, newUsageCount) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Update usage count
        const result = await client.query(
            'UPDATE users SET usage_count = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, usage_count, monthly_limit',
            [newUsageCount, email]
        );

        if (result.rows.length === 0) {
            console.log(`❌ User with email ${email} not found`);
            return;
        }

        const user = result.rows[0];
        console.log(`✅ Updated usage count for ${email}:`);
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - New Usage Count: ${user.usage_count}`);
        console.log(`   - Monthly Limit: ${user.monthly_limit}`);

    } catch (error) {
        console.error('❌ Error updating usage count:', error);
    } finally {
        await client.end();
        console.log('Database connection closed');
    }
}

// Check command line arguments
const email = process.argv[2];
const newUsageCount = parseInt(process.argv[3]);

if (!email || isNaN(newUsageCount)) {
    console.log('Usage: node update-usage.js <email> <new_usage_count>');
    console.log('Example: node update-usage.js tarcode33@gmail.com 0');
    process.exit(1);
}

console.log(`🔄 Updating usage count for ${email} to ${newUsageCount}...`);
updateUsageCount(email, newUsageCount);
