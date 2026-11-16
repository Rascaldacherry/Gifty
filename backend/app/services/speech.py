import shutil
import subprocess

import httpx

from ..config import Settings


def normalize_audio(audio: bytes) -> bytes:
    if audio.startswith(b"OggS"):
        return audio
    if not audio.startswith(b"\x1a\x45\xdf\xa3"):
        raise ValueError("Необходима запись OggOpus или WebM/Opus")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ValueError(
            "Для голоса в этом браузере установите FFmpeg на backend или используйте Firefox с OggOpus"
        )
    try:
        result = subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-v",
                "error",
                "-threads",
                "1",
                "-i",
                "pipe:0",
                "-map",
                "0:a:0",
                "-t",
                "25",
                "-ac",
                "1",
                "-ar",
                "48000",
                "-c:a",
                "libopus",
                "-b:a",
                "32k",
                "-f",
                "ogg",
                "pipe:1",
            ],
            input=audio,
            capture_output=True,
            timeout=20,
            check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (subprocess.SubprocessError, OSError):
        raise ValueError("Не удалось обработать аудиозапись. Попробуйте ещё раз") from None
    if not result.stdout.startswith(b"OggS") or len(result.stdout) > 1024 * 1024:
        raise ValueError("Некорректный формат записи")
    return result.stdout


async def transcribe_ogg(audio: bytes, settings: Settings) -> str:
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(
            "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize",
            headers={"Authorization": f"Api-Key {settings.speechkit_api_key}", "Content-Type": "audio/ogg"},
            params={
                "lang": "ru-RU",
                "format": "oggopus",
                **({"folderId": settings.speechkit_folder_id} if settings.speechkit_folder_id else {}),
            },
            content=audio,
        )
        response.raise_for_status()
        result = response.json()
        if "error_code" in result:
            raise ValueError("SpeechKit не смог распознать запись")
        return str(result.get("result", ""))[:5000]
