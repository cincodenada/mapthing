"""Fix track created type

Revision ID: 5d12d7f0c0f2
Revises: 6283d402f38d
Create Date: 2021-07-19 23:15:39.569439

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5d12d7f0c0f2'
down_revision = '6283d402f38d'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('tracks', 'created',
        type_=sa.DateTime(timezone=True),
        nullable=True,
        postgresql_using='to_timestamp(created) AT TIME ZONE \'UTC\'')
    op.alter_column('points', 'time',
        type_=sa.DateTime(timezone=True),
        nullable=True)
    pass


def downgrade():
    op.alter_column('tracks', 'created',
        type_=sa.Integer(),
        nullable=True,
        postgresql_using='cast(extract(epoch from current_timestamp) as integer)')
    op.alter_column('points', 'time',
        type_=sa.Integer(),
        nullable=True)
    pass
