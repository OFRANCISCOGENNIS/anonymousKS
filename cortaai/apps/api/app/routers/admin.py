from __future__ import annotations

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Cut, Job, Project, Subscription, TrendVideo, User
from app.schemas import JobOut, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics")
def metrics(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    def count(model) -> int:
        return db.execute(sa.select(sa.func.count()).select_from(model)).scalar_one() or 0

    jobs_by_status = dict(
        db.execute(sa.select(Job.status, sa.func.count(Job.id)).group_by(Job.status)).all()
    )
    users_by_plan = dict(
        db.execute(sa.select(User.plan, sa.func.count(User.id)).group_by(User.plan)).all()
    )
    total_minutes = db.execute(sa.select(sa.func.coalesce(sa.func.sum(User.minutes_used_month), 0.0))).scalar_one()
    return {
        "users": count(User),
        "usersByPlan": users_by_plan,
        "projects": count(Project),
        "cuts": count(Cut),
        "jobs": count(Job),
        "jobsByStatus": jobs_by_status,
        "trendVideos": count(TrendVideo),
        "activeSubscriptions": db.execute(
            sa.select(sa.func.count(Subscription.id)).where(Subscription.status == "active")
        ).scalar_one()
        or 0,
        "minutesProcessedMonth": round(float(total_minutes), 1),
    }


@router.get("/users", response_model=list[UserOut])
def list_users(
    limit: int = Query(50, le=200),
    offset: int = 0,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    users = (
        db.execute(sa.select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    )
    return [UserOut.model_validate(u) for u in users]


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    status: str | None = None,
    type: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[JobOut]:
    stmt = sa.select(Job).order_by(Job.created_at.desc()).limit(limit).offset(offset)
    if status:
        stmt = stmt.where(Job.status == status)
    if type:
        stmt = stmt.where(Job.type == type)
    jobs = db.execute(stmt).scalars().all()
    return [JobOut.model_validate(j) for j in jobs]
