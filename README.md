# Y-Reach Analytics 

**By Logic Foundry | Christopher Peterson**

Y-Reach Analytics is a lightweight, 100% client-side B2B reporting tool designed specifically for YMCA Executive Directors and Non-Profit Development Teams. 

Securing grant funding requires precise, unduplicated demographic data and geospatial impact metrics. Legacy facility management systems (like Daxko) trap this data in messy, difficult-to-parse CSV exports, costing non-profit staff dozens of hours per grant cycle. 

Y-Reach Analytics automates this workflow instantly, securely, and with zero backend overhead.

### 🚀 Core Features
* **Zero Data Liability (100% Client-Side):** For strict COPPA and IT compliance, all CSV data is parsed and aggregated entirely within the user's browser memory. No data is ever uploaded to a server or database.
* **Geospatial Impact Mapping:** Instantly aggregates subsidized members by 5-digit zip code to prove community footprint to grant committees.
* **Unduplicated Demographics:** Automatically filters out multi-visit duplicate check-ins to provide accurate headcounts across state-mandated age brackets (0-12, 13-17, 18-24, 25-64, 65+).
* **Youth Engagement Tracking:** Calculates average attendance frequency specifically for subsidized youth (0-17) to prove program efficacy.

### 🛠 Tech Stack & Architecture
This application is built as a zero-dependency Single Page Application (SPA) designed to be hosted on edge networks (like Cloudflare Pages) for $0 overhead.

* **Frontend UI:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS
* **Data Ingestion:** Papa Parse (Lightning-fast client-side CSV parsing)
* **Data Visualization:** Chart.js (Responsive, interactive canvas rendering)
* **Deployment:** Cloudflare Pages

### 💻 Local Usage
Because there is no backend, testing the application requires zero build steps or local servers.
1. Clone the repository.
2. Open `index.html` directly in any modern browser.
3. Drag and drop the provided `ymca_mock_data.csv` into the dashboard zone.
