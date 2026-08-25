from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

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


@app.get("/api/owners", response_model=List[schemas.Owner])
def read_owners(db: Session = Depends(get_db)):
    return db.query(models.Owner).order_by(models.Owner.id).all()


@app.post("/api/owners", response_model=schemas.Owner, status_code=201)
def create_owner(owner: schemas.OwnerCreate, db: Session = Depends(get_db)):
    name = owner.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Owner name is required")
    db_owner = models.Owner(name=name)
    db.add(db_owner)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Owner already exists")
    db.refresh(db_owner)
    return db_owner


@app.delete("/api/owners/{owner_id}")
def delete_owner(owner_id: int, db: Session = Depends(get_db)):
    owner = db.query(models.Owner).filter(models.Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    db.delete(owner)
    db.commit()
    return {"message": "Owner deleted successfully"}


@app.get("/api/categories", response_model=List[schemas.Category])
def read_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.type, models.Category.id).all()


@app.post("/api/categories", response_model=schemas.Category, status_code=201)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    name, category_type = category.name.strip(), category.type.strip()
    if not name or category_type not in {"income", "expense"}:
        raise HTTPException(status_code=422, detail="Valid category name and type are required")
    db_category = models.Category(name=name, type=category_type)
    db.add(db_category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category already exists")
    db.refresh(db_category)
    return db_category


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}

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


@app.put("/api/expenses/{expense_id}", response_model=schemas.Expense)
def update_expense(expense_id: int, expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for key, value in expense.model_dump().items():
        setattr(db_expense, key, value)
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
