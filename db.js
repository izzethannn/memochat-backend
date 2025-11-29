const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString && isProduction) {
    console.error('FATAL: DATABASE_URL environment variable is required in production');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Initialize database schema
async function initDb() {
    const client = await pool.connect();
    try {
        // Create users table (matches Supabase schema)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        `);

        // Create messages table (matches Supabase schema)
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(50) NOT NULL,
                room_name VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_name);
            CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
        `);

        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Error initializing database schema:', err);
    } finally {
        client.release();
    }
}

// Only run init if we have a connection string
if (connectionString) {
    initDb();
} else {
    console.warn('⚠️ No DATABASE_URL provided. Database features will not work.');
}

// Friend System Functions
const friendSystem = {
    // Generate unique invitation code for friend requests
    generateInvitationCode: () => {
        return Math.random().toString(36).substring(2, 12).toUpperCase();
    },

    // Look up user by their invitation code
    findUserByCode: async (invitationCode) => {
        const query = `
            SELECT id, username, display_name, status, last_seen
            FROM users
            WHERE my_invitation_code = $1 AND is_active = true
        `;
        return await pool.query(query, [invitationCode]);
    },

    // Send friend request
    sendFriendRequest: async (senderId, receiverId) => {
        const invitationCode = friendSystem.generateInvitationCode();
        const query = `
            INSERT INTO friend_requests (sender_id, receiver_id, invitation_code)
            VALUES ($1, $2, $3)
            ON CONFLICT (sender_id, receiver_id) DO NOTHING
            RETURNING *
        `;
        return await pool.query(query, [senderId, receiverId, invitationCode]);
    },

    // Accept friend request
    acceptFriendRequest: async (userId, requestId) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get friend request
            const requestQuery = `
                SELECT * FROM friend_requests
                WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
            `;
            const request = await client.query(requestQuery, [requestId, userId]);

            if (request.rows.length === 0) {
                throw new Error('Invalid or expired friend request');
            }

            const { sender_id, receiver_id } = request.rows[0];

            // Update request status
            await client.query(`
                UPDATE friend_requests
                SET status = 'accepted', responded_at = NOW()
                WHERE id = $1
            `, [requestId]);

            // Add to friends table (ensure user1_id < user2_id)
            const [user1, user2] = sender_id < receiver_id ? [sender_id, receiver_id] : [receiver_id, sender_id];
            await client.query(`
                INSERT INTO friends (user1_id, user2_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [user1, user2]);

            await client.query('COMMIT');
            return request.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    // Decline friend request
    declineFriendRequest: async (userId, requestId) => {
        const query = `
            UPDATE friend_requests
            SET status = 'declined', responded_at = NOW()
            WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
            RETURNING *
        `;
        return await pool.query(query, [requestId, userId]);
    },

    // Get user's friends list
    getFriends: async (userId) => {
        const query = `
            SELECT 
                u.id, u.username, u.display_name, u.status, u.last_seen,
                f.created_at as friends_since
            FROM friends f
            JOIN users u ON (u.id = f.user1_id OR u.id = f.user2_id)
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND u.id != $1
            ORDER BY u.status DESC, u.username ASC
        `;
        return await pool.query(query, [userId]);
    },

    // Get pending friend requests
    getPendingRequests: async (userId) => {
        const query = `
            SELECT 
                fr.id, fr.invitation_code, fr.created_at,
                u.id as sender_id, u.username as sender_username, 
                u.display_name as sender_display_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.sender_id
            WHERE fr.receiver_id = $1 AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        `;
        return await pool.query(query, [userId]);
    },

    // Check if users are friends
    areFriends: async (user1Id, user2Id) => {
        const [id1, id2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM friends WHERE user1_id = $1 AND user2_id = $2
            ) as are_friends
        `;
        const result = await pool.query(query, [id1, id2]);
        return result.rows[0].are_friends;
    },

    // Save direct message
    saveDirectMessage: async (senderId, receiverId, message) => {
        const query = `
            INSERT INTO direct_messages (sender_id, receiver_id, message)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        return await pool.query(query, [senderId, receiverId, message]);
    },

    // Get direct messages between two users
    getDirectMessages: async (user1Id, user2Id, limit = 50) => {
        const query = `
            SELECT 
                dm.*,
                sender.username as sender_username,
                receiver.username as receiver_username
            FROM direct_messages dm
            JOIN users sender ON sender.id = dm.sender_id
            JOIN users receiver ON receiver.id = dm.receiver_id
            WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
               OR (dm.sender_id = $2 AND dm.receiver_id = $1)
            ORDER BY dm.created_at DESC
            LIMIT $3
        `;
        const result = await pool.query(query, [user1Id, user2Id, limit]);
        return result.rows.reverse(); // Return in chronological order
    },

    // Mark messages as read
    markMessagesAsRead: async (userId, senderId) => {
        const query = `
            UPDATE direct_messages
            SET is_read = true
            WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
        `;
        return await pool.query(query, [userId, senderId]);
    },

    // Get unread message count
    getUnreadCount: async (userId) => {
        const query = `
            SELECT sender_id, COUNT(*) as unread_count
            FROM direct_messages
            WHERE receiver_id = $1 AND is_read = false
            GROUP BY sender_id
        `;
        return await pool.query(query, [userId]);
    },

    // Update user status
    updateUserStatus: async (userId, status) => {
        const query = `
            UPDATE users
            SET status = $1, last_seen = NOW()
            WHERE id = $2
        `;
        return await pool.query(query, [status, userId]);
    },

    // Get user's own invitation code
    getMyInvitationCode: async (userId) => {
        const query = `
            SELECT my_invitation_code FROM users WHERE id = $1
        `;
        return await pool.query(query, [userId]);
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    friendSystem
};
