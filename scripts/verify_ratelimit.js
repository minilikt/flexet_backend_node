// Use built-in fetch (available in Node 18+)

async function testRateLimit() {
    console.log('--- Testing Auth Rate Limit (Limit: 20 per 15m) ---');
    const url = 'http://localhost:5000/api/auth/login';

    for (let i = 1; i <= 25; i++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@example.com', password: 'password' })
            });

            const data = await res.json();
            console.log(`Request ${i}: Status ${res.status} - ${data.message}`);

            if (res.status === 429) {
                console.log('\nSUCCESS: Rate limiter triggered!');
                break;
            }
        } catch (err) {
            console.error(`Request ${i} failed:`, err.message);
        }
    }
}

testRateLimit();
