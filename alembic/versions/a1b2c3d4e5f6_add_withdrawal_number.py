"""add_withdrawal_number

Revision ID: a1b2c3d4e5f6
Revises: e2a22f0b82bb
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e2a22f0b82bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: add nullable so existing rows don't need a value yet
    op.add_column(
        'withdrawals',
        sa.Column('withdrawal_number', sa.String(50), nullable=True),
    )
    # Step 2: backfill existing rows with a unique placeholder
    op.execute(
        "UPDATE withdrawals SET withdrawal_number = 'WDR-' || lpad(id::text, 9, '0')"
    )
    # Step 3: enforce NOT NULL and uniqueness
    op.alter_column('withdrawals', 'withdrawal_number', nullable=False)
    op.create_unique_constraint('uq_withdrawals_withdrawal_number', 'withdrawals', ['withdrawal_number'])


def downgrade() -> None:
    op.drop_constraint('uq_withdrawals_withdrawal_number', 'withdrawals', type_='unique')
    op.drop_column('withdrawals', 'withdrawal_number')
