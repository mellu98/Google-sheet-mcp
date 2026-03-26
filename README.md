# Google Sheets MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with Google Sheets. Supports both local (stdio) and remote (HTTP) deployment.

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

### 1. Google Cloud Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Sheets API**
3. Create a **Service Account** and download the JSON key file
4. Share your spreadsheets with the service account email

### 2. Install & Build

```bash
npm install
npm run build
```

## Deploy on Render (Remote)

### Step 1: Push to GitHub

Push this repository to GitHub.

### Step 2: Create a Web Service on Render

1. Go to [Render](https://render.com/) and create a new **Web Service**
2. Connect your GitHub repo
3. Render will auto-detect the `Dockerfile`
4. Add an environment variable:
   - Key: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: paste the **entire content** of your service account JSON key file
5. Deploy!

### Step 3: Connect to Claude

Once deployed, your MCP server will be available at:
```
https://your-service-name.onrender.com/mcp
```

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-sheets": {
      "type": "streamable-http",
      "url": "https://your-service-name.onrender.com/mcp"
    }
  }
}
```

#### Claude Code

```bash
claude mcp add google-sheets --transport streamable-http https://your-service-name.onrender.com/mcp
```

## Local Usage (stdio)

For local usage, run with stdio transport (the default):

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/key.json npm start
```

### Claude Desktop (local)

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

### Claude Code (local)

```bash
claude mcp add google-sheets -- node /path/to/google-sheets-mcp/dist/index.js
```

## Environment Variables

| Variable | Description |
|---|---|
| `TRANSPORT` | `stdio` (default) or `http` |
| `PORT` | HTTP port (default: `3000`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to service account JSON key file |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Inline JSON key content (for Render) |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token |
