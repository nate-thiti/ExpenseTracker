from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ExpenseBase(BaseModel):
    type: str
    owner: str
    title: str
    amount: float
    category: str

class ExpenseCreate(ExpenseBase):
    # Omitted dates retain the database default of the current time.
    date: Optional[datetime] = None

class Expense(ExpenseBase):
    id: int
    date: datetime

    class Config:
        from_attributes = True


class OwnerBase(BaseModel):
    name: str


class OwnerCreate(OwnerBase):
    pass


class Owner(OwnerBase):
    id: int

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    name: str
    type: str


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True
