# Google Sheets MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Google Sheets.

## Features

- **read_spreadsheet** - Read data from a spreadsheet range
- **write_spreadsheet** - Write data to a spreadsheet range
- **create_spreadsheet** - Create a new spreadsheet
- **list_sheets** - List all sheets/tabs in a spreadsheet
- **update_cells** - Update specific individual cells
- **add_sheet** - Add a new sheet/tab
- **get_spreadsheet_info** - Get spreadsheet metadata
- **append_rows** - Append rows to the end of a sheet
- **delete_rows_columns** - Delete rows or columns from a sheet

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Google credentials

Copy `.env.example` to `.env` and configure one of the authentication methods:

#### Option A: Service Account (recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Google Sheets API
3. Create a Service Account and download the JSON key file
4. Share your spreadsheets with the service account email
5. Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/key.json`

#### Option B: OAuth2

1. Create OAuth2 credentials in Google Cloud Console
2. Obtain a refresh token using the OAuth2 flow
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "node",
      "args": ["/path/to/google-sheets-mcp/dist/index.js"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE": "/path/to/service-account-key.json"
      }
    }
  }
}
```

## Usage with Claude Code

Add to your Claude Code MCP settings:

```bash
claude mcp add google-sheets -- node /path/to/google-sheets-mcp/dist/index.js
```

Set the environment variable before running:

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/service-account-key.json
```
