from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from . import models, schemas
from .database import engine, get_db, migrate_schema, FRONTEND_DIR

models.Base.metadata.create_all(bind=engine)
migrate_schema()

app = FastAPI(title="Expense Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/expenses", response_model=List[schemas.Expense])
def read_expenses(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db)):
    expenses = db.query(models.Expense).order_by(models.Expense.date.desc()).offset(skip).limit(limit).all()
    return expenses

@app.delete("/api/expenses")
def delete_expenses(
    expense_type: Optional[str] = Query(None, alias="type"),
    category: Optional[str] = None,
    owner: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Expense)
    if expense_type:
        query = query.filter(models.Expense.type == expense_type)
    if category:
        query = query.filter(models.Expense.category == category)
    if owner:
        query = query.filter(models.Expense.owner == owner)
    if not expense_type and not category and not owner:
        raise HTTPException(status_code=400, detail="At least one filter is required")
    count = query.delete(synchronize_session=False)
    db.commit()
    return {"message": "Expenses deleted successfully", "count": count}

@app.post("/api/expenses", response_model=schemas.Expense)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = models.Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(db_expense)
    db.commit()
    return {"message": "Expense deleted successfully"}

@app.get("/api/summary")
def get_summary(db: Session = Depends(get_db)):
    summary = db.query(
        models.Expense.type,
        models.Expense.owner,
        models.Expense.category,
        func.sum(models.Expense.amount).label("total")
    ).group_by(models.Expense.type, models.Expense.owner, models.Expense.category).all()

    return [{"type": row[0], "owner": row[1], "category": row[2], "total": row[3]} for row in summary]

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
