const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:5000/api';
// Assuming we have a valid token for testing
const TOKEN = 'YOUR_TEST_TOKEN';

async function benchmark(name, fn) {
    const start = performance.now();
    try {
        await fn();
        const end = performance.now();
        console.log(`[BENCHMARK] ${name}: ${(end - start).toFixed(2)}ms`);
    } catch (err) {
        console.error(`[BENCHMARK] ${name} FAILED:`, err.message);
    }
}

async function runBenchmarks() {
    console.log('--- Performance Benchmarking Start ---');

    const config = { headers: { Authorization: `Bearer ${TOKEN}` } };

    await benchmark('GET /analytics/summary', async () => {
        await axios.get(`${BASE_URL}/analytics/summary`, config);
    });

    await benchmark('GET /analytics/muscles', async () => {
        await axios.get(`${BASE_URL}/analytics/muscles`, config);
    });

    // Note: Logging test requires a valid sessionId and exercise IDs
    /*
    await benchmark('POST /logs/submit-result', async () => {
        await axios.post(`${BASE_URL}/logs/submit-result`, {
            sessionId: '...',
            exercises: [...]
        }, config);
    });
    */

    console.log('--- Performance Benchmarking Complete ---');
}

// In a real environment, you'd run this against the dev server
// runBenchmarks();
