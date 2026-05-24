# 🔍 LogLens
**AI-Powered Log Analysis & Incident Response**

LogLens is a powerful, AI-driven log analysis tool designed to help software engineers instantly diagnose server outages, latency degradation, and API failures. 

By pasting raw server logs into the dashboard, LogLens automatically parses the entries, computes critical system health metrics, and leverages an advanced Large Language Model (LLM) pipeline to generate a comprehensive, actionable incident report. Say goodbye to manually grepping through thousands of log lines at 2 AM.

---

## ✨ Key Features

- **Automatic Log Parsing:** A multi-tiered engine that automatically identifies and extracts structured data from JSON, Apache/Nginx combined formats, and heuristic plain text logs.
- **Smart Aggregation Engine:** Groups requests by endpoint, calculates exact error rates, tracks latency trends, identifies cascading service failures, and detects silent performance degradations without throwing HTTP errors.
- **AI-Powered Root Cause Analysis:** Uses cutting-edge LLMs (via OpenRouter) to correlate failures, diagnose the root cause with specific confidence levels, and map out a chronological failure timeline.
- **Actionable Debugging Steps:** Generates a concise list of immediate actions, investigation paths, and long-term fixes, formatted with inline terminal commands.
- **Interactive Follow-Up Chat:** A fully contextual, stateless chat interface that allows engineers to interrogate the incident report, ask for specific `curl` commands, or dive deeper into affected services dynamically.
- **Beautiful, Data-Rich Dashboard:** A premium, dark-mode UI with severity badges, anomaly tables, and a top-level statistics bar showing immediate health status and recovery status.

---

## 🏗️ Architecture Flow

LogLens is built as a decoupled full-stack application using **React (Vite)** on the frontend and **Node.js (Express)** on the backend.

### 1. Data Ingestion (Frontend)
- The user pastes raw logs (up to 10MB) into the `/analyze` route of the React application.
- The UI handles loading states, validates the payload, and transmits it securely to the backend `/api/analyze` endpoint.

### 2. Processing Pipeline (Backend)
- **`logParser.js`:** The raw text hits the parser, which cascades through parsing strategies (JSON → Apache/Nginx Regex → Heuristics). It extracts standardized fields: `timestamp`, `method`, `endpoint`, `statusCode`, `latency_ms`, `service`, and `upstream`. It also tags the `detectedFormat`.
- **`logAggregator.js`:** The array of normalized log entries is processed to compute high-level statistics. It calculates the global error rate, segments the timeline into buckets to detect outages, tracks upstream service dependencies, and flags specific endpoints that cross anomaly thresholds. It also computes the `recoveryStatus` (whether the system is "Ongoing" or "Recovered" based on the final log entries).
- **`promptBuilder.js`:** The backend builds a dense, highly-structured prompt containing the aggregated metrics. It enforces strict analysis rules (e.g., instructing the AI to diagnose shared database failures if multiple microservices fail simultaneously).
- **`aiService.js`:** The prompt is dispatched to an LLM via OpenRouter. If a model fails, the service handles automatic failovers.
- **`responseParser.js`:** The AI's markdown response is parsed into distinct JSON sections (Executive Summary, Root Cause, Recommendations, Timeline).

### 3. Presentation & Interaction (Frontend)
- The structured report and raw aggregated stats are returned to the frontend and cached in `sessionStorage`.
- **`Results.jsx`:** The React dashboard renders the data dynamically. It displays the Stats Bar, an Anomaly Table with calculated error rates, and the parsed markdown sections from the AI.
- **`FollowUpChat.jsx`:** Users can ask contextual follow-up questions. To ensure resilience against backend server restarts, the frontend automatically passes the entire `reportContext` back to the `/api/chat` route, ensuring the AI never loses its context memory.

---
## Demo Video



https://github.com/user-attachments/assets/4196a579-3911-4b89-b993-501933abdb4c



---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- An OpenRouter API Key (for the AI analysis)

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   # Install Backend dependencies
   cd server
   npm install
   
   # Install Frontend dependencies
   cd ../client
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the `server/` directory:
   ```env
   PORT=3001
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

3. **Start the Application:**
   Open two terminal windows.
   
   **Terminal 1 (Backend):**
   ```bash
   cd server
   npm run dev
   ```
   
   **Terminal 2 (Frontend):**
   ```bash
   cd client
   npm run dev
   ```

4. **Open in Browser:**
   Navigate to `http://localhost:5173` to start analyzing your logs!

---

## 🛠️ Tech Stack
- **Frontend:** React, Vite, Lucide-React (Icons), Vanilla CSS
- **Backend:** Node.js, Express
- **AI:** OpenRouter (Supports Llama 3, Claude, Gemini, etc.)
