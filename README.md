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
- **Database:** SQLite (with SQLAlchemy ORM).
- **Libraries:** Chart.js (for data visualization).

## 🚀 Getting Started

### Prerequisites
Make sure you have Python installed on your machine. You will also need to install the backend dependencies.

### 1. Setup the Backend
Open your terminal and navigate to the project directory:
```bash
cd ExpenseTracker
```

Install the required Python packages:
```bash
pip install fastapi uvicorn sqlalchemy pydantic
```

Run the FastAPI server:
```bash
uvicorn backend.main:app --reload
```
The API will be available at `http://127.0.0.1:8000`.

### 2. Run the Frontend
Since the frontend uses plain HTML/JS/CSS, no build step or node server is required! 
Simply double-click on `frontend/index.html` to open it in your browser.

## 📂 Project Structure
```
ExpenseTracker/
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
