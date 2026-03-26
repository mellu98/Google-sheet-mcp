#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { google, sheets_v4 } from "googleapis";
import { z } from "zod";
import express from "express";
import { randomUUID } from "node:crypto";

// --- Authentication ---

function authenticate() {
  // Option 1: Service Account Key File
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  // Option 2: Service Account Key (inline JSON)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  // Option 3: OAuth2 Client Credentials
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return oauth2Client;
  }

  throw new Error(
    "No Google credentials configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE, " +
      "GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN."
  );
}

const auth = authenticate();
const sheets = google.sheets({ version: "v4", auth });

// --- MCP Server ---

function createServer() {
  const server = new McpServer({
    name: "google-sheets-mcp",
    version: "1.0.0",
  });

  // Tool 1: Read data from a spreadsheet
  server.tool(
    "read_spreadsheet",
    "Read data from a Google Sheets spreadsheet. Returns the values in the specified range.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet (from the URL)"),
      range: z
        .string()
        .describe('The A1 notation range to read, e.g. "Sheet1!A1:D10" or "Sheet1"'),
    },
    async ({ spreadsheetId, range }) => {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  range: response.data.range,
                  majorDimension: response.data.majorDimension,
                  values: response.data.values ?? [],
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: Write data to a spreadsheet
  server.tool(
    "write_spreadsheet",
    "Write data to a Google Sheets spreadsheet. Overwrites the specified range with the provided values.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
      range: z.string().describe('The A1 notation range to write, e.g. "Sheet1!A1:D10"'),
      values: z
        .array(z.array(z.string()))
        .describe("2D array of values to write (rows of cells)"),
      valueInputOption: z
        .enum(["RAW", "USER_ENTERED"])
        .default("USER_ENTERED")
        .describe("How to interpret input data. USER_ENTERED parses formulas; RAW stores as-is."),
    },
    async ({ spreadsheetId, range, values, valueInputOption }) => {
      try {
        const response = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption,
          requestBody: { values },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  updatedRange: response.data.updatedRange,
                  updatedRows: response.data.updatedRows,
                  updatedColumns: response.data.updatedColumns,
                  updatedCells: response.data.updatedCells,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: Create a new spreadsheet
  server.tool(
    "create_spreadsheet",
    "Create a new Google Sheets spreadsheet.",
    {
      title: z.string().describe("Title for the new spreadsheet"),
      sheetNames: z
        .array(z.string())
        .optional()
        .describe("Optional list of sheet/tab names to create"),
    },
    async ({ title, sheetNames }) => {
      try {
        const requestBody: sheets_v4.Schema$Spreadsheet = {
          properties: { title },
        };

        if (sheetNames && sheetNames.length > 0) {
          requestBody.sheets = sheetNames.map((name) => ({
            properties: { title: name },
          }));
        }

        const response = await sheets.spreadsheets.create({ requestBody });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  spreadsheetId: response.data.spreadsheetId,
                  spreadsheetUrl: response.data.spreadsheetUrl,
                  title: response.data.properties?.title,
                  sheets: response.data.sheets?.map((s) => s.properties?.title),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: List sheets/tabs in a spreadsheet
  server.tool(
    "list_sheets",
    "List all sheets (tabs) in a Google Sheets spreadsheet.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    },
    async ({ spreadsheetId }) => {
      try {
        const response = await sheets.spreadsheets.get({
          spreadsheetId,
          fields: "sheets.properties",
        });

        const sheetList =
          response.data.sheets?.map((s) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title,
            index: s.properties?.index,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount,
          })) ?? [];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(sheetList, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: Batch update specific cells
  server.tool(
    "update_cells",
    "Update specific cells in a Google Sheets spreadsheet. Allows updating multiple individual cells at once.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
      updates: z
        .array(
          z.object({
            range: z.string().describe('Cell reference in A1 notation, e.g. "Sheet1!A1"'),
            value: z.string().describe("Value to set in the cell"),
          })
        )
        .describe("List of cell updates to apply"),
    },
    async ({ spreadsheetId, updates }) => {
      try {
        const data = updates.map((u) => ({
          range: u.range,
          values: [[u.value]],
        }));

        const response = await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  totalUpdatedCells: response.data.totalUpdatedCells,
                  totalUpdatedRows: response.data.totalUpdatedRows,
                  totalUpdatedColumns: response.data.totalUpdatedColumns,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: Add a new sheet/tab
  server.tool(
    "add_sheet",
    "Add a new sheet (tab) to an existing Google Sheets spreadsheet.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
      title: z.string().describe("Title for the new sheet"),
      rowCount: z.number().optional().describe("Number of rows (default: 1000)"),
      columnCount: z.number().optional().describe("Number of columns (default: 26)"),
    },
    async ({ spreadsheetId, title, rowCount, columnCount }) => {
      try {
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title,
                    gridProperties: {
                      rowCount: rowCount ?? 1000,
                      columnCount: columnCount ?? 26,
                    },
                  },
                },
              },
            ],
          },
        });

        const addedSheet = response.data.replies?.[0]?.addSheet;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  sheetId: addedSheet?.properties?.sheetId,
                  title: addedSheet?.properties?.title,
                  rowCount: addedSheet?.properties?.gridProperties?.rowCount,
                  columnCount: addedSheet?.properties?.gridProperties?.columnCount,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: Get spreadsheet metadata
  server.tool(
    "get_spreadsheet_info",
    "Get metadata and properties of a Google Sheets spreadsheet.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    },
    async ({ spreadsheetId }) => {
      try {
        const response = await sheets.spreadsheets.get({ spreadsheetId });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  spreadsheetId: response.data.spreadsheetId,
                  title: response.data.properties?.title,
                  locale: response.data.properties?.locale,
                  timeZone: response.data.properties?.timeZone,
                  spreadsheetUrl: response.data.spreadsheetUrl,
                  sheetCount: response.data.sheets?.length ?? 0,
                  sheets: response.data.sheets?.map((s) => ({
                    sheetId: s.properties?.sheetId,
                    title: s.properties?.title,
                    index: s.properties?.index,
                    rowCount: s.properties?.gridProperties?.rowCount,
                    columnCount: s.properties?.gridProperties?.columnCount,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 8: Append rows to a spreadsheet
  server.tool(
    "append_rows",
    "Append rows of data to the end of a Google Sheets spreadsheet.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
      range: z
        .string()
        .describe('The A1 notation of the table to append to, e.g. "Sheet1!A:E"'),
      values: z
        .array(z.array(z.string()))
        .describe("2D array of values to append (rows of cells)"),
    },
    async ({ spreadsheetId, range, values }) => {
      try {
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: { values },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  updatedRange: response.data.updates?.updatedRange,
                  updatedRows: response.data.updates?.updatedRows,
                  updatedCells: response.data.updates?.updatedCells,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 9: Delete rows or columns
  server.tool(
    "delete_rows_columns",
    "Delete rows or columns from a sheet in a Google Sheets spreadsheet.",
    {
      spreadsheetId: z.string().describe("The ID of the spreadsheet"),
      sheetId: z.number().describe("The numeric ID of the sheet (tab)"),
      dimension: z
        .enum(["ROWS", "COLUMNS"])
        .describe("Whether to delete rows or columns"),
      startIndex: z.number().describe("Start index (0-based, inclusive)"),
      endIndex: z.number().describe("End index (0-based, exclusive)"),
    },
    async ({ spreadsheetId, sheetId, dimension, startIndex, endIndex }) => {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension,
                    startIndex,
                    endIndex,
                  },
                },
              },
            ],
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully deleted ${dimension.toLowerCase()} ${startIndex} to ${endIndex - 1}.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// --- Start Server ---

async function main() {
  const mode = process.env.TRANSPORT ?? "stdio";

  if (mode === "http") {
    // HTTP mode for remote deployment (Render, etc.)
    const app = express();
    app.use(express.json());

    // Store transports by session ID
    const transports = new Map<string, StreamableHTTPServerTransport>();

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Handle MCP requests via StreamableHTTP
    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        // Existing session
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
      } else if (!sessionId) {
        // New session - create transport and server
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };

        const server = createServer();
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);

        if (transport.sessionId) {
          transports.set(transport.sessionId, transport);
        }
      } else {
        // Invalid session ID
        res.status(400).json({ error: "Invalid or expired session ID" });
      }
    });

    // Handle SSE GET requests for streaming
    app.get("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.status(400).json({ error: "Invalid or missing session ID" });
      }
    });

    // Handle DELETE for session cleanup
    app.delete("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
      } else {
        res.status(400).json({ error: "Invalid or missing session ID" });
      }
    });

    const port = parseInt(process.env.PORT ?? "3000", 10);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Google Sheets MCP server running on http://0.0.0.0:${port}/mcp`);
    });
  } else {
    // Stdio mode for local usage
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
