const request = require('supertest');
const bcrypt = require('bcrypt');
jest.mock('bcrypt');
const { app, server } = require('../server');
const db = require('../db');

jest.mock('../db', () => ({
    query: jest.fn(),
    pool: {
        on: jest.fn(),
        connect: jest.fn()
    }
}));

describe('Server Endpoints', () => {
    beforeEach(() => {
        db.query.mockReset();
        bcrypt.compare.mockReset();
        bcrypt.hash = jest.fn().mockResolvedValue('hashed_password');
    });

    describe('GET /', () => {
        test('responds with index.html', async () => {
            const response = await request(app).get('/');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });
    });

    describe('POST /api/auth/register', () => {
        test('registers a new user', async () => {
            // Mock user check (empty) and insert (success with RETURNING id)
            db.query
                .mockResolvedValueOnce({ rows: [] }) // Check existence
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert returning id

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'user_' + Date.now().toString().slice(-5),
                    password: 'Password123!'
                });

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('message', 'User created successfully');
            expect(response.body).toHaveProperty('userId');
            expect(typeof response.body.userId).toBe('number');
        });

        test('rejects missing credentials', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({});

            expect(response.statusCode).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        test('logs in an existing user', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: 'hashedpassword'
            };

            db.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // Find user
                .mockResolvedValueOnce({ rows: [] }); // Update last login

            bcrypt.compare.mockResolvedValue(true); // Password match

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'Password123!'
                });

            if (response.statusCode !== 200) {
                console.log('Login failed:', response.statusCode, response.body);
            }
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('userId', 1);
        });
    });
});
