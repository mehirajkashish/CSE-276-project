import json
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Generator, List, Optional, Tuple
import requests

from app.core.config import settings


class NoLLMConfiguredError(RuntimeError):
    """Raised when no LLM provider (Gemini, OpenAI, or Ollama) is configured."""


class LLMProviderError(RuntimeError):
    """Raised when a configured LLM provider fails after retries."""


class LLMProviderAdapter(ABC):
    provider_id: str
    provider_label: str

    @abstractmethod
    def is_configured(self) -> bool:
        ...

    @abstractmethod
    def list_models(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def supports_model(self, model_id: str) -> bool:
        ...

    @abstractmethod
    def generate(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Tuple[str, str]:
        ...

    @abstractmethod
    def stream(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Generator[Tuple[str, str], None, None]:
        ...


class GeminiProviderAdapter(LLMProviderAdapter):
    provider_id = "gemini"
    provider_label = "Google Gemini"

    CATALOG = [
        {
            "id": "gemini-flash-lite-latest",
            "label": "Flash-Lite Latest",
            "badge": "Fast",
            "desc": "Fast & reliable default for everyday chat and study",
        },
        {
            "id": "gemini-3.1-flash-lite",
            "label": "Gemini 3.1 Flash-Lite",
            "badge": "Speed",
            "desc": "Lightweight 3.1 model for crisp, rapid answers",
        },
        {
            "id": "gemini-3.1-flash-lite-preview",
            "label": "Gemini 3.1 Lite Prev",
            "badge": "Preview",
            "desc": "Latest 3.1 Flash-Lite preview release",
        },
        {
            "id": "gemini-flash-latest",
            "label": "Gemini Flash Latest",
            "badge": "Balanced",
            "desc": "Balanced reasoning, coding, and synthesis",
        },
        {
            "id": "gemini-3-flash-preview",
            "label": "Gemini 3 Flash",
            "badge": "Next-Gen",
            "desc": "Next-gen preview for deeper analysis",
        },
        {
            "id": "gemini-pro-latest",
            "label": "Gemini Pro Latest",
            "badge": "Deep",
            "desc": "Complex proofs & architecture (subject to quota)",
        },
    ]

    FALLBACK_ORDER = [
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite-preview",
        "gemini-flash-latest",
        "gemini-3-flash-preview",
    ]

    def is_configured(self) -> bool:
        return bool((settings.gemini_api_key or "").strip())

    def list_models(self) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        return [
            {
                **m,
                "provider": self.provider_id,
                "provider_label": self.provider_label,
                "configured": True,
            }
            for m in self.CATALOG
        ]

    def supports_model(self, model_id: str) -> bool:
        clean = (model_id or "").strip().lower()
        return clean.startswith("gemini-")

    def _build_payload(
        self,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> Dict[str, Any]:
        contents: List[Dict[str, Any]] = []
        for turn in messages:
            role_raw = (turn.get("role") or "user").strip().lower()
            text = (turn.get("content") or "").strip()
            if not text:
                continue
            gemini_role = "model" if role_raw == "assistant" else "user"
            contents.append({"role": gemini_role, "parts": [{"text": text}]})

        return {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

    def _candidate_models(self, preferred_model: Optional[str]) -> List[str]:
        primary = (preferred_model or settings.gemini_model or self.FALLBACK_ORDER[0]).strip()
        return [primary] + [m for m in self.FALLBACK_ORDER if m != primary]

    def _extract_error(self, resp: requests.Response) -> str:
        try:
            err_json = resp.json()
            msg = err_json.get("error", {}).get("message")
            if msg:
                return f"Gemini API Error ({resp.status_code}): {msg}"
        except Exception:
            pass
        return f"Gemini API Error ({resp.status_code}): {resp.text[:240]}"

    def generate(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Tuple[str, str]:
        api_key = (settings.gemini_api_key or "").strip()
        if not api_key:
            raise NoLLMConfiguredError("GEMINI_API_KEY is not configured.")

        payload = self._build_payload(system_instruction, messages, temperature, max_tokens)
        headers = {"x-goog-api-key": api_key}
        last_error = "Gemini request failed."

        for candidate in self._candidate_models(model):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:generateContent"
            for attempt in range(2):
                try:
                    resp = requests.post(url, headers=headers, json=payload, timeout=30.0)
                except requests.RequestException as exc:
                    last_error = f"Gemini network error: {exc}"
                    if attempt == 0:
                        time.sleep(0.5)
                        continue
                    break

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise LLMProviderError("Gemini returned empty candidates.")
                    parts = candidates[0].get("content", {}).get("parts", [])
                    chunks = [p.get("text", "") for p in parts if not p.get("thought") and p.get("text")]
                    if chunks:
                        return "\n".join(chunks).strip(), candidate
                    if parts and parts[0].get("text"):
                        return parts[0]["text"].strip(), candidate
                    finish_reason = candidates[0].get("finishReason", "UNKNOWN")
                    raise LLMProviderError(f"Gemini returned no text (finish reason: {finish_reason}).")

                last_error = self._extract_error(resp)
                if resp.status_code in (429, 500, 503) and attempt == 0:
                    time.sleep(0.6)
                    continue
                if resp.status_code in (404, 429, 500, 503):
                    break
                raise LLMProviderError(last_error)

        raise LLMProviderError(last_error)

    def stream(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Generator[Tuple[str, str], None, None]:
        api_key = (settings.gemini_api_key or "").strip()
        if not api_key:
            raise NoLLMConfiguredError("GEMINI_API_KEY is not configured.")

        payload = self._build_payload(system_instruction, messages, temperature, max_tokens)
        headers = {"x-goog-api-key": api_key}
        resp = None
        used_model = model
        last_error = "Gemini stream failed."

        for candidate in self._candidate_models(model):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:streamGenerateContent?alt=sse"
            for attempt in range(2):
                try:
                    r = requests.post(url, headers=headers, json=payload, timeout=(15.0, 60.0), stream=True)
                except requests.RequestException as exc:
                    last_error = f"Gemini stream network error: {exc}"
                    if attempt == 0:
                        time.sleep(0.5)
                        continue
                    break

                if r.status_code == 200:
                    resp = r
                    used_model = candidate
                    break

                last_error = self._extract_error(r)
                status_code = r.status_code
                r.close()
                if status_code in (429, 500, 503) and attempt == 0:
                    time.sleep(0.6)
                    continue
                if status_code in (404, 429, 500, 503):
                    break
                raise LLMProviderError(last_error)

            if resp is not None:
                break

        if resp is None:
            raise LLMProviderError(last_error)

        try:
            resp.encoding = "utf-8"
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line or not raw_line.startswith("data:"):
                    continue
                json_str = raw_line[5:].strip()
                if not json_str or json_str == "[DONE]":
                    continue
                try:
                    chunk_obj = json.loads(json_str)
                except Exception:
                    continue
                candidates = chunk_obj.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    if part.get("thought"):
                        continue
                    txt = part.get("text")
                    if txt:
                        yield txt, used_model
        finally:
            resp.close()


class OpenAICompatibleAdapter(LLMProviderAdapter):
    provider_id = "openai"
    provider_label = "OpenAI / Compatible"

    DEFAULT_MODELS = [
        {
            "id": "gpt-4o-mini",
            "label": "GPT-4o Mini",
            "badge": "OpenAI",
            "desc": "Fast, capable general-purpose OpenAI model",
        },
        {
            "id": "gpt-4o",
            "label": "GPT-4o",
            "badge": "OpenAI Pro",
            "desc": "High-accuracy reasoning, coding, and writing",
        },
    ]

    def is_configured(self) -> bool:
        return bool((settings.openai_api_key or "").strip())

    def list_models(self) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        configured_model = (settings.openai_model or "").strip()
        items = list(self.DEFAULT_MODELS)
        if configured_model and not any(m["id"] == configured_model for m in items):
            items.insert(
                0,
                {
                    "id": configured_model,
                    "label": configured_model,
                    "badge": "Custom",
                    "desc": "Configured OpenAI-compatible model",
                },
            )
        return [
            {
                **m,
                "provider": self.provider_id,
                "provider_label": self.provider_label,
                "configured": True,
            }
            for m in items
        ]

    def supports_model(self, model_id: str) -> bool:
        clean = (model_id or "").strip()
        if not clean:
            return False
        if clean == (settings.openai_model or "").strip():
            return True
        return clean.startswith(("gpt-", "o1", "o3", "o4", "openai/", "deepseek", "llama", "qwen", "mixtral"))

    def _endpoint(self) -> str:
        base = (settings.openai_base_url or "https://api.openai.com/v1").strip().rstrip("/")
        return f"{base}/chat/completions"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {(settings.openai_api_key or '').strip()}",
            "Content-Type": "application/json",
        }

    def _build_messages(self, system_instruction: str, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        out = [{"role": "system", "content": system_instruction}]
        for turn in messages:
            role = "assistant" if (turn.get("role") or "").lower() == "assistant" else "user"
            content = (turn.get("content") or "").strip()
            if content:
                out.append({"role": role, "content": content})
        return out

    def generate(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Tuple[str, str]:
        if not self.is_configured():
            raise NoLLMConfiguredError("OPENAI_API_KEY is not configured.")

        target_model = (model or settings.openai_model or "gpt-4o-mini").strip()
        payload = {
            "model": target_model,
            "messages": self._build_messages(system_instruction, messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        last_err = "OpenAI request failed."
        for attempt in range(2):
            try:
                resp = requests.post(self._endpoint(), headers=self._headers(), json=payload, timeout=35.0)
            except requests.RequestException as exc:
                last_err = f"OpenAI network error: {exc}"
                if attempt == 0:
                    time.sleep(0.5)
                    continue
                raise LLMProviderError(last_err) from exc

            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                text = (choices[0].get("message", {}).get("content") or "").strip() if choices else ""
                if not text:
                    raise LLMProviderError("OpenAI returned an empty completion.")
                return text, data.get("model") or target_model

            last_err = f"OpenAI API Error ({resp.status_code}): {resp.text[:240]}"
            if resp.status_code in (429, 500, 503) and attempt == 0:
                time.sleep(0.6)
                continue
            raise LLMProviderError(last_err)

        raise LLMProviderError(last_err)

    def stream(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Generator[Tuple[str, str], None, None]:
        if not self.is_configured():
            raise NoLLMConfiguredError("OPENAI_API_KEY is not configured.")

        target_model = (model or settings.openai_model or "gpt-4o-mini").strip()
        payload = {
            "model": target_model,
            "messages": self._build_messages(system_instruction, messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        resp = None
        last_err = "OpenAI stream failed."
        for attempt in range(2):
            try:
                r = requests.post(self._endpoint(), headers=self._headers(), json=payload, timeout=(15.0, 60.0), stream=True)
            except requests.RequestException as exc:
                last_err = f"OpenAI stream network error: {exc}"
                if attempt == 0:
                    time.sleep(0.5)
                    continue
                raise LLMProviderError(last_err) from exc

            if r.status_code == 200:
                resp = r
                break

            last_err = f"OpenAI Stream Error ({r.status_code}): {r.text[:240]}"
            code = r.status_code
            r.close()
            if code in (429, 500, 503) and attempt == 0:
                time.sleep(0.6)
                continue
            raise LLMProviderError(last_err)

        if resp is None:
            raise LLMProviderError(last_err)

        try:
            resp.encoding = "utf-8"
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line or not raw_line.startswith("data:"):
                    continue
                chunk_str = raw_line[5:].strip()
                if not chunk_str or chunk_str == "[DONE]":
                    continue
                try:
                    obj = json.loads(chunk_str)
                except Exception:
                    continue
                choices = obj.get("choices", [])
                if not choices:
                    continue
                delta = choices[0].get("delta", {}).get("content")
                if delta:
                    yield delta, obj.get("model") or target_model
        finally:
            resp.close()


class OllamaLocalAdapter(LLMProviderAdapter):
    provider_id = "ollama"
    provider_label = "Local Ollama"

    def is_configured(self) -> bool:
        return bool((settings.ollama_base_url or "").strip())

    def _base(self) -> str:
        return (settings.ollama_base_url or "").strip().rstrip("/")

    def list_models(self) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        configured_model = (settings.ollama_model or "llama3.1").strip()
        try:
            r = requests.get(f"{self._base()}/api/tags", timeout=2.0)
            if r.status_code == 200:
                tags = [m.get("name") for m in r.json().get("models", []) if m.get("name")]
                if tags:
                    return [
                        {
                            "id": f"ollama:{name}",
                            "label": name,
                            "badge": "Local",
                            "desc": "Local Ollama model running on your machine",
                            "provider": self.provider_id,
                            "provider_label": self.provider_label,
                            "configured": True,
                        }
                        for name in tags[:8]
                    ]
        except Exception:
            return []
        return [
            {
                "id": f"ollama:{configured_model}",
                "label": configured_model,
                "badge": "Local",
                "desc": "Configured local Ollama model",
                "provider": self.provider_id,
                "provider_label": self.provider_label,
                "configured": True,
            }
        ]

    def supports_model(self, model_id: str) -> bool:
        clean = (model_id or "").strip()
        return clean.startswith("ollama:") or clean == (settings.ollama_model or "").strip()

    def _strip_prefix(self, model_id: str) -> str:
        clean = (model_id or "").strip()
        if clean.startswith("ollama:"):
            return clean[len("ollama:"):]
        return clean or (settings.ollama_model or "llama3.1").strip()

    def _build_messages(self, system_instruction: str, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        out = [{"role": "system", "content": system_instruction}]
        for turn in messages:
            role = "assistant" if (turn.get("role") or "").lower() == "assistant" else "user"
            content = (turn.get("content") or "").strip()
            if content:
                out.append({"role": role, "content": content})
        return out

    def generate(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Tuple[str, str]:
        if not self.is_configured():
            raise NoLLMConfiguredError("OLLAMA_BASE_URL is not configured.")
        target = self._strip_prefix(model)
        payload = {
            "model": target,
            "messages": self._build_messages(system_instruction, messages),
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        try:
            r = requests.post(f"{self._base()}/api/chat", json=payload, timeout=45.0)
            if r.status_code != 200:
                raise LLMProviderError(f"Ollama Error ({r.status_code}): {r.text[:200]}")
            data = r.json()
            text = (data.get("message", {}).get("content") or "").strip()
            if not text:
                raise LLMProviderError("Ollama returned an empty response.")
            return text, f"ollama:{target}"
        except requests.RequestException as exc:
            raise LLMProviderError(f"Ollama connection error: {exc}") from exc

    def stream(
        self,
        model: str,
        system_instruction: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Generator[Tuple[str, str], None, None]:
        if not self.is_configured():
            raise NoLLMConfiguredError("OLLAMA_BASE_URL is not configured.")
        target = self._strip_prefix(model)
        payload = {
            "model": target,
            "messages": self._build_messages(system_instruction, messages),
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        try:
            r = requests.post(f"{self._base()}/api/chat", json=payload, timeout=(10.0, 60.0), stream=True)
            if r.status_code != 200:
                msg = r.text[:200]
                r.close()
                raise LLMProviderError(f"Ollama Stream Error ({r.status_code}): {msg}")
        except requests.RequestException as exc:
            raise LLMProviderError(f"Ollama stream connection error: {exc}") from exc

        try:
            r.encoding = "utf-8"
            for line in r.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                txt = obj.get("message", {}).get("content")
                if txt:
                    yield txt, f"ollama:{target}"
        finally:
            r.close()


class LLMRouter:
    """Unified multi-provider router across Gemini, OpenAI/compatible APIs, and local Ollama."""

    def __init__(self):
        self.adapters: List[LLMProviderAdapter] = [
            GeminiProviderAdapter(),
            OpenAICompatibleAdapter(),
            OllamaLocalAdapter(),
        ]

    def configured_providers(self) -> List[LLMProviderAdapter]:
        return [a for a in self.adapters if a.is_configured()]

    def has_any_provider(self) -> bool:
        return len(self.configured_providers()) > 0

    def list_available_models(self) -> Dict[str, Any]:
        models: List[Dict[str, Any]] = []
        providers_status: List[Dict[str, Any]] = []
        for adapter in self.adapters:
            configured = adapter.is_configured()
            adapter_models = adapter.list_models() if configured else []
            providers_status.append(
                {
                    "id": adapter.provider_id,
                    "label": adapter.provider_label,
                    "configured": configured and (len(adapter_models) > 0 if adapter.provider_id == "ollama" else True),
                }
            )
            models.extend(adapter_models)

        default_model = models[0]["id"] if models else None
        return {
            "configured": len(models) > 0,
            "default_model": default_model,
            "providers": providers_status,
            "models": models,
        }

    def _ordered_adapters(self, requested_model: Optional[str] = None) -> List[Tuple[LLMProviderAdapter, str]]:
        configured = self.configured_providers()
        if not configured:
            raise NoLLMConfiguredError(
                "No LLM provider is configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL in backend/.env."
            )

        clean_req = (requested_model or "").strip()
        ordered: List[Tuple[LLMProviderAdapter, str]] = []

        if clean_req:
            for adapter in configured:
                if adapter.supports_model(clean_req):
                    ordered.append((adapter, clean_req))
                    break

        for adapter in configured:
            if any(existing_a.provider_id == adapter.provider_id for existing_a, _ in ordered):
                continue
            default_id = (
                settings.gemini_model
                if adapter.provider_id == "gemini"
                else settings.openai_model
                if adapter.provider_id == "openai"
                else settings.ollama_model
            )
            ordered.append((adapter, default_id))

        return ordered

    def generate(
        self,
        system_instruction: str,
        messages: List[Dict[str, str]],
        requested_model: Optional[str] = None,
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Tuple[str, str, str]:
        """Returns (answer_text, model_used, provider_label)."""
        last_exc: Optional[Exception] = None
        for adapter, target_model in self._ordered_adapters(requested_model):
            try:
                text, used_model = adapter.generate(
                    model=target_model,
                    system_instruction=system_instruction,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return text, used_model, adapter.provider_label
            except Exception as exc:
                last_exc = exc
                print(f"[LLMRouter] Provider {adapter.provider_id} ({target_model}) failed: {exc}")
                continue
        raise LLMProviderError(str(last_exc or "All configured LLM providers failed."))

    def stream(
        self,
        system_instruction: str,
        messages: List[Dict[str, str]],
        requested_model: Optional[str] = None,
        temperature: float = 0.35,
        max_tokens: int = 2048,
    ) -> Generator[Tuple[str, str, str], None, None]:
        """Yields (delta_text, model_used, provider_label) with automatic provider failover before first token."""
        last_exc: Optional[Exception] = None
        for adapter, target_model in self._ordered_adapters(requested_model):
            yielded_any = False
            try:
                for delta, used_model in adapter.stream(
                    model=target_model,
                    system_instruction=system_instruction,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                ):
                    yielded_any = True
                    yield delta, used_model, adapter.provider_label
                if yielded_any:
                    return
            except Exception as exc:
                last_exc = exc
                print(f"[LLMRouter] Stream provider {adapter.provider_id} ({target_model}) failed: {exc}")
                if yielded_any:
                    raise
                continue
        raise LLMProviderError(str(last_exc or "All configured LLM stream providers failed."))


llm_router = LLMRouter()
