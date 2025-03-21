const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.text({ type: "*/*", limit: "10mb" }));
app.use(bodyParser.json({ type: "application/json", limit: "10mb" }));

/**
 * Extract JSON from text
 * @param {string} text - Text content that may contain JSON
 * @returns {object|null} - Parsed JSON object or null if not found
 */
const extractJson = (text) => {
  try {
    // Find JSON pattern in text by looking for content between triple backticks with json annotation
    const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const match = text.match(jsonRegex);

    if (match && match[1]) {
      // Extract the JSON string and parse it
      const jsonString = match[1];
      const parsedJson = JSON.parse(jsonString);
      return parsedJson;
    }

    // If no JSON in code blocks, try to find JSON between curly braces
    const fallbackRegex = /(\{[\s\S]*\})/;
    const fallbackMatch = text.match(fallbackRegex);

    if (fallbackMatch && fallbackMatch[1]) {
      try {
        const parsedJson = JSON.parse(fallbackMatch[1]);
        return parsedJson;
      } catch (e) {
        // Not valid JSON
      }
    }

    return null; // No JSON found
  } catch (error) {
    console.error("Error extracting JSON:", error);
    return null;
  }
};

// Define routes that support both text and JSON input formats
app.post("/extract", (req, res) => {
  try {
    let inputText;

    // Handle different request formats from Copilot Studio
    if (typeof req.body === "string") {
      // Direct text input
      inputText = req.body;
    } else if (req.body && req.body.text) {
      // JSON object with text property
      inputText = req.body.text;
    } else if (req.body && typeof req.body === "object") {
      // Try to use the first property found
      const firstProp = Object.values(req.body)[0];
      if (typeof firstProp === "string") {
        inputText = firstProp;
      } else {
        inputText = JSON.stringify(req.body);
      }
    } else {
      return res.status(400).json({ error: "No valid input provided" });
    }

    if (!inputText) {
      return res.status(400).json({ error: "No input text provided" });
    }

    const extractedJson = extractJson(inputText);

    if (extractedJson) {
      // Format response to be easily consumable by Microsoft Copilot Studio
      res.json(extractedJson);
    } else {
      res.status(404).json({
        status: "error",
        error: "No valid JSON found in the input text",
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      status: "error",
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Add a simple GET endpoint for testing
app.get("/extract", (req, res) => {
  const query = req.query.text;

  if (!query) {
    return res
      .status(400)
      .json({ error: "No input text provided in query parameter" });
  }

  const extractedJson = extractJson(query);

  if (extractedJson) {
    res.json({
      status: "success",
      extractedJson: extractedJson,
      jsonString: JSON.stringify(extractedJson),
    });
  } else {
    res.status(404).json({
      status: "error",
      error: "No valid JSON found in the input text",
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "JSON Extractor API is running",
  });
});

// Root endpoint for basic information
app.get("/", (req, res) => {
  res.status(200).json({
    name: "JSON Extractor API",
    description: "Extract JSON objects from text content",
    endpoints: [
      {
        path: "/extract",
        method: "POST",
        description: "Extract JSON from text content",
      },
      {
        path: "/extract",
        method: "GET",
        description: "Extract JSON from text query parameter",
      },
      {
        path: "/health",
        method: "GET",
        description: "Health check endpoint",
      },
    ],
    usage:
      "POST text content to /extract or use GET /extract?text=yourTextHere",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`JSON extractor service running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  process.exit(0);
});
