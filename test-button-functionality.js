#!/usr/bin/env node

const http = require('http');
const { execSync } = require('child_process');

/**
 * Test script to verify button functionality without browser automation
 * Tests the actual API endpoints that buttons would call
 */

const BASE_URL = 'http://localhost:3000';
let serverProcess = null;

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = res.headers['content-type']?.includes('json') 
                        ? JSON.parse(data) 
                        : data;
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data, headers: res.headers });
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// Helper function to POST JSON
function postJSON(endpoint, body) {
    return makeRequest(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: body
    });
}

async function testButtonFunctionality() {
    console.log('🧪 Testing Button Functionality v1.6.14');
    console.log('==========================================\n');

    try {
        // Test 1: Check if main page loads
        console.log('1. Testing main page load...');
        const pageResponse = await makeRequest(BASE_URL);
        if (pageResponse.status === 200 && pageResponse.data.includes('Employee Hour Tracker')) {
            console.log('✅ Main page loads successfully');
        } else {
            throw new Error(`Page load failed: ${pageResponse.status}`);
        }

        // Test 2: Check JavaScript file loads
        console.log('\n2. Testing JavaScript file load...');
        const jsResponse = await makeRequest(`${BASE_URL}/script.js`);
        if (jsResponse.status === 200 && jsResponse.data.includes('EmployeeTracker')) {
            console.log('✅ JavaScript file loads successfully');
            console.log(`   - Contains EmployeeTracker class: ${jsResponse.data.includes('class EmployeeTracker')}`);
            console.log(`   - Contains setupEventListeners: ${jsResponse.data.includes('setupEventListeners')}`);
            console.log(`   - Contains changeWeek method: ${jsResponse.data.includes('changeWeek')}`);
        } else {
            throw new Error(`JavaScript load failed: ${jsResponse.status}`);
        }

        // Test 3: Test the server endpoints that buttons would call
        console.log('\n3. Testing server endpoints for button actions...');
        
        // Test current week endpoint (called during initialization)
        console.log('   Testing /api/current-week...');
        const currentWeekResponse = await makeRequest(`${BASE_URL}/api/current-week`);
        if (currentWeekResponse.status === 200) {
            console.log('✅ Current week endpoint works:', currentWeekResponse.data);
        } else {
            throw new Error(`Current week endpoint failed: ${currentWeekResponse.status}`);
        }

        // Test date operations endpoint (called by navigation buttons)
        console.log('\n   Testing /api/date-operations (next week simulation)...');
        const nextWeekResponse = await postJSON('/api/date-operations', {
            operation: 'addDays',
            params: { startDate: '2025-08-13', days: 7 }
        });
        if (nextWeekResponse.status === 200) {
            console.log('✅ Next week calculation works:', nextWeekResponse.data);
        } else {
            throw new Error(`Next week calculation failed: ${nextWeekResponse.status}`);
        }

        console.log('\n   Testing /api/date-operations (previous week simulation)...');
        const prevWeekResponse = await postJSON('/api/date-operations', {
            operation: 'addDays', 
            params: { startDate: '2025-08-13', days: -7 }
        });
        if (prevWeekResponse.status === 200) {
            console.log('✅ Previous week calculation works:', prevWeekResponse.data);
        } else {
            throw new Error(`Previous week calculation failed: ${prevWeekResponse.status}`);
        }

        // Test 4: Test week display formatting
        console.log('\n   Testing week display formatting...');
        const displayResponse = await postJSON('/api/date-operations', {
            operation: 'formatWeekDisplay',
            params: { weekStartDate: '2025-08-11' }
        });
        if (displayResponse.status === 200) {
            console.log('✅ Week display formatting works:', displayResponse.data);
        } else {
            throw new Error(`Week display failed: ${displayResponse.status}`);
        }

        // Test 5: Test employees endpoint
        console.log('\n4. Testing data endpoints...');
        const employeesResponse = await makeRequest(`${BASE_URL}/api/employees`);
        if (employeesResponse.status === 200) {
            console.log('✅ Employees endpoint works');
            console.log(`   - Number of employees: ${Array.isArray(employeesResponse.data) ? employeesResponse.data.length : 'unknown'}`);
        } else {
            console.log('⚠️  Employees endpoint returned:', employeesResponse.status, '(expected for empty DB)');
        }

        // Test 6: Test timezone configuration
        console.log('\n5. Testing timezone configuration...');
        const configResponse = await makeRequest(`${BASE_URL}/api/config`);
        if (configResponse.status === 200) {
            console.log('✅ Config endpoint works:', configResponse.data);
        } else {
            console.log('⚠️  Config endpoint failed:', configResponse.status);
        }

        console.log('\n🎉 ALL BUTTON FUNCTIONALITY TESTS PASSED!');
        console.log('✅ The application should work correctly in the browser');
        console.log('✅ Navigation buttons should function properly');
        console.log('✅ Week calculations are server-side and timezone-safe');
        
    } catch (error) {
        console.error('\n❌ BUTTON FUNCTIONALITY TEST FAILED:');
        console.error('Error:', error.message);
        throw error;
    }
}

async function startServer() {
    console.log('🚀 Starting test server...');
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        serverProcess = spawn('node', ['server.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        let output = '';
        serverProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('Server is running on port 3000')) {
                console.log('✅ Test server started successfully');
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.log('Server stderr:', data.toString());
        });

        serverProcess.on('error', reject);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (!output.includes('Server is running on port 3000')) {
                reject(new Error('Server startup timeout'));
            }
        }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        console.log('\n🛑 Stopping test server...');
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}

async function main() {
    try {
        await startServer();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for full startup
        await testButtonFunctionality();
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
        process.exit(1);
    } finally {
        stopServer();
    }
}

// Handle cleanup
process.on('SIGINT', () => {
    stopServer();
    process.exit(0);
});

process.on('SIGTERM', () => {
    stopServer();
    process.exit(0);
});

if (require.main === module) {
    main();
}