# Expense Tracker

A lightweight, modern, full-stack Expense Tracker built to help you manage your daily spending and visualize your data through interactive charts.

## 🌟 Features
- **Add Expenses:** Easily log your title, amount, and category.
- **Interactive Dashboard:** Beautiful pie charts generated via Chart.js to visualize your spending habits.
- **Manage Records:** View a clean list of recent expenses and delete entries if you made a mistake.
- **RESTful API:** A robust Python backend serving data to the frontend.

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (Custom styling with CSS Variables), Vanilla JavaScript.
- **Backend:** Python, FastAPI.
- **Database:** SQLite locally, Postgres (Neon) in production.
- **Libraries:** Chart.js (for data visualization).

## 🚀 Getting Started

```bash
cd ExpenseTracker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Local data is stored in SQLite under `data/`.

## ☁️ Deploy (Render + Neon)

1. Create a Postgres database at [https://console.neon.tech](https://console.neon.tech). Copy the **direct** connection string (`postgresql://...`).
2. Push this repo to GitHub.
3. On [Render](https://dashboard.render.com), create a Blueprint from the repo (or open `https://dashboard.render.com/blueprint/new?repo=<YOUR_GITHUB_REPO_URL>`).
4. When prompted, paste the Neon URL into `DATABASE_URL`.
5. After deploy, open the `onrender.com` URL.

On Render, the app reads `DATABASE_URL`. If it is unset, it falls back to SQLite.

## 📂 Project Structure
```
├── render.yaml
├── requirements.txt
├── backend/
│   ├── main.py        # FastAPI application and endpoints
│   ├── database.py    # SQLite database connection setup
│   ├── models.py      # SQLAlchemy database models
│   └── schemas.py     # Pydantic schemas for data validation
└── frontend/
    ├── index.html     # Main dashboard UI
    ├── style.css      # Modern, responsive styling
    └── app.js         # API integration and Chart.js logic
```

## 📝 License
This project is open-source and available for portfolio or personal use.
