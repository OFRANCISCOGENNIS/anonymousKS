"""Task dispatch with graceful degradation.

Tries Celery (Redis broker) first; when the broker is unreachable the task
function runs inline in a daemon thread so the product remains fully usable
in local/dev environments without Redis or workers.
"""
from __future__ import annotations

import logging
import threading

logger = logging.getLogger(__name__)


def dispatch_task(task, *args) -> str:
    """Returns "celery" or "inline" depending on the execution path taken."""
    try:
        task.apply_async(args=args, retry=False)
        return "celery"
    except Exception:
        logger.info("Celery broker unavailable — running %s inline", getattr(task, "name", task))

        def _run() -> None:
            try:
                task(*args)  # calling the task object runs the function synchronously
            except Exception:
                logger.exception("Inline task %s failed", getattr(task, "name", task))

        threading.Thread(target=_run, daemon=True).start()
        return "inline"
