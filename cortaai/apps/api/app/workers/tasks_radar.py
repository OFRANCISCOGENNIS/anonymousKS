"""Radar Viral workers: trend fetching + niche pattern computation.

# INTEGRAÇÃO PAGA: YouTube Data API v3 (YOUTUBE_API_KEY) — search.list costs
100 quota units per call, so results are cached in Redis (quota-safe layer,
TTL settings.radar_cache_ttl_seconds). Offline/no-key fallback: deterministic
seed-style mock videos so the Radar always has fresh-looking data.

Scheduled by Celery beat (app/workers/celery_app.py):
- radar_scan_all              — hourly
- compute_all_niche_patterns  — every 6 hours
"""
from __future__ import annotations

import hashlib
import json
import random
from collections import Counter
from datetime import datetime, timedelta, timezone

import httpx
import sqlalchemy as sa

from app.config import settings
from app.constants import CAPTION_PRESETS, NICHES, PERIODS
from app.database import SessionLocal
from app.models import NichePattern, TrendAnalysis, TrendVideo
from app.services import llm
from app.services.progress import _get_redis
from app.services.retention import build_retention_timeline, compute_retention_index
from app.workers.celery_app import celery_app

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

_PERIOD_HOURS = {"24h": 24, "7d": 168, "30d": 720}


# --- quota-safe cache layer -----------------------------------------------------

def _cache_get(key: str) -> list | None:
    client = _get_redis()
    if client is None:
        return None
    try:
        raw = client.get(f"cortaai:radar:{key}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def _cache_set(key: str, value: list) -> None:
    client = _get_redis()
    if client is None:
        return
    try:
        client.setex(f"cortaai:radar:{key}", settings.radar_cache_ttl_seconds, json.dumps(value, ensure_ascii=False))
    except Exception:
        pass


# --- fetching -----------------------------------------------------------------

def _parse_iso8601_duration(value: str) -> float:
    """PT1M32S → seconds."""
    import re

    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value or "")
    if not m:
        return 0.0
    h, mi, s = (int(g) if g else 0 for g in m.groups())
    return float(h * 3600 + mi * 60 + s)


def fetch_youtube_trending(niche: str) -> list[dict]:
    """Real YouTube Data API fetch (cached). # INTEGRAÇÃO PAGA: YouTube Data API v3."""
    cached = _cache_get(f"yt:{niche}")
    if cached is not None:
        return cached

    if not settings.youtube_api_key:
        return _mock_trending(niche)

    try:
        published_after = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        search = httpx.get(
            YOUTUBE_SEARCH_URL,
            params={
                "part": "snippet",
                "q": f"{niche} shorts",
                "type": "video",
                "videoDuration": "short",
                "order": "viewCount",
                "publishedAfter": published_after,
                "relevanceLanguage": "pt",
                "regionCode": "BR",
                "maxResults": 10,
                "key": settings.youtube_api_key,
            },
            timeout=15,
        )
        search.raise_for_status()
        ids = [item["id"]["videoId"] for item in search.json().get("items", [])]
        if not ids:
            return _mock_trending(niche)
        videos = httpx.get(
            YOUTUBE_VIDEOS_URL,
            params={
                "part": "snippet,statistics,contentDetails",
                "id": ",".join(ids),
                "key": settings.youtube_api_key,
            },
            timeout=15,
        )
        videos.raise_for_status()
        items: list[dict] = []
        for v in videos.json().get("items", []):
            stats = v.get("statistics", {})
            snippet = v.get("snippet", {})
            published = snippet.get("publishedAt")
            items.append(
                {
                    "platform": "youtube",
                    "external_id": v["id"],
                    "url": f"https://www.youtube.com/shorts/{v['id']}",
                    "title": snippet.get("title", ""),
                    "channel": snippet.get("channelTitle"),
                    "thumbnail_url": (snippet.get("thumbnails", {}).get("high") or {}).get("url"),
                    "niche": niche,
                    "language": "pt-BR",
                    "duration_seconds": _parse_iso8601_duration(v.get("contentDetails", {}).get("duration", "")),
                    "views": int(stats.get("viewCount", 0)),
                    "likes": int(stats.get("likeCount", 0)),
                    "comments": int(stats.get("commentCount", 0)),
                    "published_at": published,
                }
            )
        _cache_set(f"yt:{niche}", items)
        return items
    except Exception:
        return _mock_trending(niche)


_MOCK_TITLES: dict[str, list[str]] = {
    "finanças": ["O erro que te mantém pobre (e como sair dele)", "Quanto rende R$ 1.000 no CDB hoje?"],
    "fitness": ["3 exercícios que valem por 1 hora de academia", "O que comer antes do treino (de verdade)"],
    "podcast": ["Ele contou como saiu das dívidas ao vivo", "A resposta que deixou todo mundo em choque"],
    "humor": ["POV: sua mãe achou a boca do fogão suja", "Todo brasileiro já viveu isso no mercado"],
    "educação": ["Aprenda isso antes da sua próxima prova", "O truque de memorização que a escola não ensina"],
    "tecnologia": ["Essa IA faz seu trabalho em 10 segundos", "Pare de usar o ChatGPT do jeito errado"],
    "beleza": ["Skincare de 3 passos que funciona de verdade", "O erro que envelhece sua pele 10 anos"],
    "games": ["A jogada mais insana que você vai ver hoje", "Esse segredo estava no jogo desde 2019"],
}
_MOCK_CHANNELS = ["Cortes do Prime", "Canal Aprovado", "ShortsBR", "Studio Viral", "Na Régua Cortes", "Feed Explodiu"]


def _mock_trending(niche: str) -> list[dict]:
    """Deterministic per (niche, day-hour) so the hourly scan produces stable data offline."""
    now = datetime.now(timezone.utc)
    seed = int(hashlib.sha256(f"{niche}:{now:%Y%m%d%H}".encode()).hexdigest(), 16)
    rng = random.Random(seed)
    items = []
    for i, title in enumerate(_MOCK_TITLES.get(niche, ["Vídeo em alta no nicho"])):
        views = rng.randint(80_000, 3_500_000)
        age_hours = rng.randint(6, 96)
        items.append(
            {
                "platform": rng.choice(["youtube", "youtube", "tiktok", "instagram"]),
                "external_id": f"mock-{niche}-{now:%Y%m%d}-{i}",
                "url": f"https://www.youtube.com/shorts/mock{seed % 100000}{i}",
                "title": title,
                "channel": rng.choice(_MOCK_CHANNELS),
                "thumbnail_url": f"https://picsum.photos/seed/{niche}{i}/720/1280",
                "niche": niche,
                "language": "pt-BR",
                "duration_seconds": float(rng.randint(18, 75)),
                "views": views,
                "likes": int(views * rng.uniform(0.03, 0.09)),
                "comments": int(views * rng.uniform(0.002, 0.009)),
                "published_at": (now - timedelta(hours=age_hours)).isoformat(),
            }
        )
    return items


# --- persistence ----------------------------------------------------------------

def upsert_trend_video(db, item: dict) -> TrendVideo:
    video = db.execute(
        sa.select(TrendVideo).where(
            TrendVideo.platform == item["platform"], TrendVideo.external_id == item["external_id"]
        )
    ).scalar_one_or_none()

    published_at = item.get("published_at")
    if isinstance(published_at, str):
        published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    age_hours = 1.0
    if published_at:
        age_hours = max((datetime.now(timezone.utc) - published_at).total_seconds() / 3600.0, 1.0)
    views_per_hour = round(item.get("views", 0) / age_hours, 2)
    retention_index = compute_retention_index(
        item.get("views", 0), views_per_hour, item.get("likes", 0), item.get("comments", 0), published_at
    )

    if video is None:
        video = TrendVideo(
            platform=item["platform"],
            external_id=item["external_id"],
            url=item["url"],
            title=item["title"],
            channel=item.get("channel"),
            thumbnail_url=item.get("thumbnail_url"),
            niche=item["niche"],
            language=item.get("language"),
            duration_seconds=item.get("duration_seconds"),
        )
        db.add(video)
    video.views = item.get("views", 0)
    video.views_per_hour = views_per_hour
    video.likes = item.get("likes", 0)
    video.comments = item.get("comments", 0)
    video.published_at = published_at
    video.retention_index = retention_index
    video.fetched_at = datetime.now(timezone.utc)
    db.flush()
    return video


def ensure_analysis(db, video: TrendVideo) -> TrendAnalysis:
    """Guarantees a full Raio-X for a trend video (LLM or deterministic mock)."""
    analysis = db.execute(
        sa.select(TrendAnalysis).where(TrendAnalysis.trend_video_id == video.id)
    ).scalar_one_or_none()
    if analysis is not None:
        return analysis
    duration = int(video.duration_seconds or 35)
    blocks = llm.generate_xray(video.title, video.niche, duration, seed_key=video.external_id)
    analysis = TrendAnalysis(
        trend_video_id=video.id,
        sound=blocks["sound"],
        image=blocks["image"],
        structure=blocks["structure"],
        retention_timeline=build_retention_timeline(duration, video.retention_index, video.external_id),
    )
    db.add(analysis)
    db.flush()
    return analysis


# --- tasks ------------------------------------------------------------------------

@celery_app.task(name="app.workers.tasks_radar.radar_scan_niche")
def radar_scan_niche(niche: str) -> int:
    db = SessionLocal()
    try:
        items = fetch_youtube_trending(niche)
        for item in items:
            video = upsert_trend_video(db, item)
            ensure_analysis(db, video)
        db.commit()
        return len(items)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks_radar.radar_scan_all")
def radar_scan_all() -> int:
    total = 0
    for niche in NICHES:
        try:
            total += radar_scan_niche(niche)
        except Exception:
            continue
    return total


@celery_app.task(name="app.workers.tasks_radar.compute_niche_patterns")
def compute_niche_patterns(niche: str, period: str = "7d") -> None:
    """Aggregates trend_videos + trend_analyses into a NichePattern row."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=_PERIOD_HOURS.get(period, 168))
        videos = (
            db.execute(
                sa.select(TrendVideo)
                .where(TrendVideo.niche == niche, TrendVideo.fetched_at >= cutoff)
                .order_by(TrendVideo.retention_index.desc())
                .limit(50)
            )
            .scalars()
            .all()
        )
        seed = int(hashlib.sha256(f"{niche}:{period}".encode()).hexdigest(), 16)
        rng = random.Random(seed)

        durations = [v.duration_seconds for v in videos if v.duration_seconds]
        avg_duration = round(sum(durations) / len(durations), 1) if durations else float(30 + seed % 30)

        styles: Counter = Counter()
        sounds: list[dict] = []
        hooks: list[dict] = []
        for v in videos:
            a = v.analysis
            if a is None:
                continue
            style = ((a.image or {}).get("captions") or {}).get("style")
            if style:
                styles[style] += 1
            track = (a.sound or {}).get("track")
            if track and (a.sound or {}).get("trackTrending"):
                sounds.append({"track": track, "bpm": (a.sound or {}).get("bpm"), "usedBy": v.channel})
            hook = (a.structure or {}).get("hookText")
            if hook:
                hooks.append({"type": (a.structure or {}).get("hookType"), "text": hook, "retentionIndex": v.retention_index})

        top_styles = [s for s, _ in styles.most_common(3)] or rng.sample(CAPTION_PRESETS, 3)
        best_times = sorted(rng.sample(["07:30", "11:45", "12:30", "17:00", "18:30", "19:45", "21:00", "22:15"], 3))

        pattern = db.execute(
            sa.select(NichePattern).where(NichePattern.niche == niche, NichePattern.period == period)
        ).scalar_one_or_none()
        if pattern is None:
            pattern = NichePattern(niche=niche, period=period)
            db.add(pattern)
        pattern.avg_duration = avg_duration
        pattern.top_caption_styles = top_styles
        pattern.trending_sounds = sounds[:5]
        pattern.top_hooks = sorted(hooks, key=lambda x: -(x.get("retentionIndex") or 0))[:5]
        pattern.best_post_times = best_times
        pattern.computed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks_radar.compute_all_niche_patterns")
def compute_all_niche_patterns() -> None:
    for niche in NICHES:
        for period in PERIODS:
            try:
                compute_niche_patterns(niche, period)
            except Exception:
                continue
