# Employee Hour Tracker API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

The API uses two authentication methods:
1. **Session-based authentication** for web interface
2. **API Token authentication** for external access (v1.6.0+)

### API Token Authentication
Include the API token in the request header:
```
X-API-Token: your-api-token-here
```

---

## Endpoints

### Authentication Endpoints

#### POST /api/login
Authenticate as admin user.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /api/logout
End current session.

**Response:**
```json
{
  "success": true
}
```

#### GET /api/check-auth
Check if current session is authenticated.

**Response:**
```json
{
  "authenticated": true
}
```

#### POST /api/change-credentials
Change admin username and password. **Requires authentication.**

**Request:**
```json
{
  "newUsername": "newadmin",
  "newPassword": "newsecurepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credentials updated successfully"
}
```

---

### Employee Management

#### GET /api/employees
Get all employees.

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Smith",
    "created_at": "2025-01-15 10:30:00"
  },
  {
    "id": 2,
    "name": "Jane Doe",
    "created_at": "2025-01-15 10:31:00"
  }
]
```

#### POST /api/employees
Add a new employee. **Requires authentication.**

**Request:**
```json
{
  "name": "Alice Johnson"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "Alice Johnson",
  "created_at": "2025-01-20 14:22:00"
}
```

#### PUT /api/employees/:id
Update employee name. **Requires authentication.**

**Request:**
```json
{
  "name": "Alice Johnson-Smith"
}
```

**Response:**
```json
{
  "success": true
}
```

#### DELETE /api/employees/:id
Delete an employee. **Requires authentication.**

**Response:**
```json
{
  "success": true
}
```

---

### Time Entries

#### GET /api/time-entries/:weekStart
Get time entries for a specific week.

**Parameters:**
- `weekStart`: Date in YYYY-MM-DD format (must be a Monday)

**Example:** `GET /api/time-entries/2025-01-13`

**Response:**
```json
[
  {
    "id": 1,
    "employee_id": 1,
    "name": "John Smith",
    "week_start": "2025-01-13",
    "monday": "Entered",
    "tuesday": "Entered",
    "wednesday": "Not Entered",
    "thursday": "Entered",
    "friday": "Entered",
    "saturday": "Empty",
    "sunday": "Empty"
  }
]
```

#### POST /api/time-entries
Update a time entry. **Requires authentication.**

**Request:**
```json
{
  "employeeId": 1,
  "weekStart": "2025-01-13",
  "day": "wednesday",
  "status": "Entered"
}
```

**Response:**
```json
{
  "success": true
}
```

**Valid Status Values:**
- `Empty` - No work scheduled
- `Not Entered` - Time not entered
- `Entered` - Time entered correctly
- `Incorrect` - Time entered incorrectly

---

### Analytics

#### GET /api/analytics/summary
Get summary statistics for a date range.

**Query Parameters:**
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)
- `includeAll`: Include employees with no entries (true/false)

**Example:** `GET /api/analytics/summary?start=2025-01-01&end=2025-01-31&includeAll=true`

**Response:**
```json
{
  "total_employees": 8,
  "total_weeks": 4,
  "total_empty": 56,
  "total_entered": 120,
  "total_not_entered": 40,
  "total_incorrect": 8
}
```

#### GET /api/analytics/by-employee
Get per-employee analytics for a date range.

**Query Parameters:**
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)
- `includeAll`: Include employees with no entries (true/false)

**Example:** `GET /api/analytics/by-employee?start=2025-01-01&end=2025-01-31&includeAll=false`

**Response:**
```json
[
  {
    "employee_id": 1,
    "name": "John Smith",
    "total_empty": 8,
    "total_entered": 18,
    "total_not_entered": 2,
    "total_incorrect": 0
  }
]
```

---

### Export

#### GET /api/export/:format
Export data in various formats.

**Parameters:**
- `format`: Export format (`csv`, `json`, or `excel`)

**Query Parameters:**
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)

**Example:** `GET /api/export/csv?start=2025-01-01&end=2025-01-31`

**Response:**
- **CSV Format:** Returns CSV file with headers
- **JSON Format:** Returns JSON array of time entries
- **Excel Format:** Returns base64-encoded Excel data

---

### Settings

#### GET /api/version
Get application version and session information.

**Response:**
```json
{
  "version": "1.6.0",
  "sessionVersion": "1.6.0",
  "needsRefresh": false
}
```

#### GET /api/config
Get client configuration.

**Response:**
```json
{
  "baseUrl": "https://yourdomain.com"
}
```

#### GET /api/settings/:key
Get a specific setting value.

**Example:** `GET /api/settings/default_week`

**Response:**
```json
{
  "key": "default_week",
  "value": "current"
}
```

#### PUT /api/settings/:key
Update a setting. **Requires authentication.**

**Request:**
```json
{
  "value": "last"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Danger Zone

All danger zone endpoints **require authentication**.

#### DELETE /api/danger-zone/clear-analytics
Clear all time entries while keeping employees.

**Response:**
```json
{
  "success": true,
  "message": "All time entries cleared"
}
```

#### DELETE /api/danger-zone/clear-employees
Delete all employees and their time entries.

**Response:**
```json
{
  "success": true,
  "message": "All employees and time entries deleted"
}
```

#### DELETE /api/danger-zone/clear-period
Clear time entries for a specific date range.

**Request:**
```json
{
  "start": "2025-01-01",
  "end": "2025-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 28
}
```

#### DELETE /api/danger-zone/delete-all-data
Factory reset - deletes all data including settings.

**Response:**
```json
{
  "success": true,
  "message": "All data has been deleted"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Default limit:** 100 requests per minute per IP
- **Authenticated limit:** 1000 requests per minute per token

When rate limit is exceeded, the API returns:
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```

---

## Error Responses

All endpoints use standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "error": "Error message here"
}
```

---

## API Tokens

### Generating API Tokens
API tokens can be generated in the Management section of the web interface or via API:

#### POST /api/tokens
Generate a new API token. **Requires authentication.**

**Request:**
```json
{
  "name": "Integration Token",
  "expires": "2025-12-31"
}
```

**Response:**
```json
{
  "token": "ht_1234567890abcdef",
  "name": "Integration Token",
  "created": "2025-01-20",
  "expires": "2025-12-31"
}
```

#### GET /api/tokens
List all API tokens. **Requires authentication.**

**Response:**
```json
[
  {
    "id": 1,
    "name": "Integration Token",
    "created": "2025-01-20",
    "expires": "2025-12-31",
    "last_used": "2025-01-20"
  }
]
```

#### DELETE /api/tokens/:id
Revoke an API token. **Requires authentication.**

**Response:**
```json
{
  "success": true
}
```