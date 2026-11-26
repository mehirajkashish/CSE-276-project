import re
from typing import Any, Dict, List, Optional
import requests

from app.core.config import settings

RECENCY_TERMS = (
    "latest", "newest", "recent", "currently", "today", "this week", "this month", "this year",
    "2025", "2026", "2027", "current version", "release notes", "what changed", "news",
    "price of", "weather", "stock", "score", "update on", "updated documentation",
)


class WebSearchService:
    """
    Retrieves live web snippets via Tavily, Serper, or built-in DuckDuckGo/Wikipedia instant APIs
    when enabled. Transparently reports unavailability instead of fabricating internet results.
    """

    def is_enabled(self) -> bool:
        return bool(settings.enable_web_search)

    def configured_provider_name(self) -> str:
        if (settings.tavily_api_key or "").strip():
            return "Tavily"
        if (settings.serper_api_key or "").strip():
            return "Serper"
        if settings.enable_web_search:
            return "DuckDuckGo/Wikipedia"
        return "Disabled"

    def should_search_web(
        self,
        question: str,
        mode: str = "learn",
        explicit_web_search: Optional[bool] = None,
    ) -> bool:
        if explicit_web_search is False:
            return False
        if not self.is_enabled():
            return False
        if explicit_web_search is True:
            return True

        q_low = (question or "").strip().lower()
        if len(q_low) < 8:
            return False
        if any(term in q_low for term in RECENCY_TERMS):
            return True
        if mode == "research" and re.search(r"\b(current|modern|industry|state of the art|202\d)\b", q_low):
            return True
        return False

    def search(self, query: str, max_results: int = 4) -> Dict[str, Any]:
        """Returns {'status': 'ok'|'empty'|'unavailable'|'disabled', 'provider': str, 'results': [...], 'error': str|None}."""
        if not self.is_enabled():
            return {"status": "disabled", "provider": "Disabled", "results": [], "error": "Web search is disabled."}

        clean_q = (query or "").strip()
        if not clean_q:
            return {"status": "empty", "provider": self.configured_provider_name(), "results": [], "error": None}

        tavily_key = (settings.tavily_api_key or "").strip()
        if tavily_key:
            try:
                res = self._search_tavily(clean_q, tavily_key, max_results=max_results)
                return {"status": "ok" if res else "empty", "provider": "Tavily", "results": res, "error": None}
            except Exception as exc:
                return {"status": "unavailable", "provider": "Tavily", "results": [], "error": str(exc)}

        serper_key = (settings.serper_api_key or "").strip()
        if serper_key:
            try:
                res = self._search_serper(clean_q, serper_key, max_results=max_results)
                return {"status": "ok" if res else "empty", "provider": "Serper", "results": res, "error": None}
            except Exception as exc:
                return {"status": "unavailable", "provider": "Serper", "results": [], "error": str(exc)}

        # Zero-key fallback using DuckDuckGo Instant Answer + Wikipedia summary search
        try:
            results = self._search_public_instant(clean_q, max_results=max_results)
            return {
                "status": "ok" if results else "empty",
                "provider": "DuckDuckGo/Wikipedia",
                "results": results,
                "error": None,
            }
        except Exception as exc:
            return {"status": "unavailable", "provider": "DuckDuckGo/Wikipedia", "results": [], "error": str(exc)}

    def _search_tavily(self, query: str, api_key: str, max_results: int = 4) -> List[Dict[str, str]]:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": query, "max_results": max_results, "search_depth": "basic"},
            timeout=10.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Tavily HTTP {resp.status_code}")
        items = resp.json().get("results", [])
        return [
            {
                "title": (item.get("title") or "Web Result").strip(),
                "url": (item.get("url") or "").strip(),
                "snippet": (item.get("content") or "")[:420].strip(),
            }
            for item in items[:max_results]
            if item.get("url")
        ]

    def _search_serper(self, query: str, api_key: str, max_results: int = 4) -> List[Dict[str, str]]:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": max_results},
            timeout=10.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Serper HTTP {resp.status_code}")
        items = resp.json().get("organic", [])
        return [
            {
                "title": (item.get("title") or "Web Result").strip(),
                "url": (item.get("link") or "").strip(),
                "snippet": (item.get("snippet") or "")[:420].strip(),
            }
            for item in items[:max_results]
            if item.get("link")
        ]

    def _search_public_instant(self, query: str, max_results: int = 4) -> List[Dict[str, str]]:
        results: List[Dict[str, str]] = []
        headers = {"User-Agent": "StudyMindAI/2.0 (Educational Assistant)"}

        # 1. DuckDuckGo Instant Answer JSON
        try:
            r_ddg = requests.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                headers=headers,
                timeout=6.0,
            )
            if r_ddg.status_code == 200:
                data = r_ddg.json()
                abstract = (data.get("AbstractText") or "").strip()
                abstract_url = (data.get("AbstractURL") or "").strip()
                heading = (data.get("Heading") or query).strip()
                if abstract and abstract_url:
                    results.append({"title": heading, "url": abstract_url, "snippet": abstract[:420]})
                for topic in data.get("RelatedTopics", [])[:3]:
                    if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                        results.append(
                            {
                                "title": topic.get("Text", "")[:80],
                                "url": topic.get("FirstURL", ""),
                                "snippet": topic.get("Text", "")[:320],
                            }
                        )
        except Exception:
            pass

        # 2. Wikipedia OpenSearch + Summary fallback for factual / encyclopedic lookups
        if len(results) < max_results:
            r_wiki = requests.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json",
                    "srlimit": max(1, max_results - len(results)),
                },
                headers=headers,
                timeout=6.0,
            )
            if r_wiki.status_code == 200:
                for item in r_wiki.json().get("query", {}).get("search", []):
                    title = (item.get("title") or "").strip()
                    snippet_raw = re.sub(r"<[^>]+>", "", item.get("snippet") or "").strip()
                    if title and snippet_raw:
                        slug = title.replace(" ", "_")
                        results.append(
                            {
                                "title": f"{title} — Wikipedia",
                                "url": f"https://en.wikipedia.org/wiki/{slug}",
                                "snippet": snippet_raw[:380],
                            }
                        )

        return results[:max_results]


web_search_service = WebSearchService()
