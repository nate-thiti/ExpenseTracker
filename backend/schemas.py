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
