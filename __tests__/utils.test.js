const {
    sanitizeInput,
    isValidRoomName,
    isValidUsername,
    generateId,
    generateRoomId
} = require('../server');

describe('Utility Functions', () => {
    describe('sanitizeInput', () => {
        test('removes HTML tags', () => {
            expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('scriptalert("xss")/scriptHello');
        });

        test('trims whitespace', () => {
            expect(sanitizeInput('  hello  ')).toBe('hello');
        });

        test('truncates long input', () => {
            const longString = 'a'.repeat(600);
            expect(sanitizeInput(longString).length).toBe(500);
        });
    });

    describe('isValidRoomName', () => {
        test('accepts valid room names', () => {
            expect(isValidRoomName('general')).toBe(true);
            expect(isValidRoomName('gaming')).toBe(true);
        });

        test('accepts custom room names', () => {
            expect(isValidRoomName('custom_12345')).toBe(true);
        });

        test('rejects invalid room names', () => {
            expect(isValidRoomName('invalid_room')).toBe(false);
            expect(isValidRoomName('')).toBe(false);
        });
    });

    describe('isValidUsername', () => {
        test('accepts valid usernames', () => {
            expect(isValidUsername('user123')).toBe(true);
            expect(isValidUsername('My Name')).toBe(true);
        });

        test('rejects short usernames', () => {
            expect(isValidUsername('ab')).toBe(false);
        });

        test('rejects long usernames', () => {
            expect(isValidUsername('a'.repeat(21))).toBe(false);
        });

        test('rejects invalid characters', () => {
            expect(isValidUsername('user@name')).toBe(false);
        });
    });

    describe('generateId', () => {
        test('returns a string', () => {
            expect(typeof generateId()).toBe('string');
        });

        test('returns unique ids', () => {
            expect(generateId()).not.toBe(generateId());
        });
    });

    describe('generateRoomId', () => {
        test('starts with custom_', () => {
            expect(generateRoomId().startsWith('custom_')).toBe(true);
        });
    });
});
