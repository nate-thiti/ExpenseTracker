from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from .database import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # 'income' or 'expense'
    owner = Column(String, index=True, default="ฉัน") # 'ฉัน' or 'แฟน'
    title = Column(String, index=True)
    amount = Column(Float)
    category = Column(String, index=True)
    date = Column(DateTime, default=datetime.utcnow)
