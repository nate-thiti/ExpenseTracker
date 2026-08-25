from pydantic import BaseModel
from datetime import datetime

class ExpenseBase(BaseModel):
    type: str
    owner: str
    title: str
    amount: float
    category: str

class ExpenseCreate(ExpenseBase):
    pass

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
