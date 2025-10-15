from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# class Product(SQLModel, table=True):
#     id: Optional[int] = Field(default=None, primary_key=True)
#     sku: str = Field(index=True, unique=True)
#     name: str
#     description: str = ""
#     price_cents: int
#     image_url: Optional[str] = None
#     active: bool = True
#     created_at: datetime = Field(default_factory=datetime.utcnow)

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(index=True, unique=True)           # keep existing
    name: str
    description: str = ""
    price_cents: int
    image_url: Optional[str] = None
    hcpcs_code: Optional[str] = Field(default=None, index=True)  # NEW
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Cart(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CartItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    cart_id: int = Field(foreign_key="cart.id")
    product_id: int = Field(foreign_key="product.id")
    quantity: int = Field(default=1)

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    status: str = Field(default="pending")  # pending, paid, canceled
    total_cents: int = 0
    stripe_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    product_id: int = Field(foreign_key="product.id")
    quantity: int
    unit_price_cents: int


