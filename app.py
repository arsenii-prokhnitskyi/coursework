"""Serve the UnApp pages and validate requests without storing personal data."""

import os
from pathlib import Path
import re

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge


ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
app.json.ensure_ascii = False

# Match the syntax accepted by an HTML email input, including local domains.
EMAIL = re.compile(
    r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
)
FIELD_LIMITS = {"name": (2, 70), "email": (1, 120), "message": (10, 1000)}


def validate_request(data):
    errors = {}
    for name, (minimum, maximum) in FIELD_LIMITS.items():
        value = data.get(name)
        if not isinstance(value, str) or not value.strip():
            errors[name] = "Заповни це поле. Самих пробілів недостатньо."
            continue
        value = value.strip()
        # HTML minlength/maxlength count UTF-16 code units, including emoji.
        length = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
        if length < minimum:
            errors[name] = f"Введи щонайменше {minimum} символів."
        elif length > maximum:
            errors[name] = f"Введи не більше {maximum} символів."
        elif name == "email" and not EMAIL.fullmatch(value):
            errors[name] = "Введи коректну адресу електронної пошти."
    return errors


@app.get("/")
@app.get("/index.html")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/blog.html")
def blog():
    return send_from_directory(ROOT, "blog.html")


@app.get("/services.html")
def services():
    return send_from_directory(ROOT, "services.html")


@app.get("/404.html")
def not_found_page():
    # Unknown nested URLs still need assets and the home link from the site root.
    markup = (ROOT / "404.html").read_text(encoding="utf-8")
    markup = markup.replace('    <link rel="icon"', '    <base href="/">\n    <link rel="icon"', 1)
    return app.response_class(markup, status=404, mimetype="text/html")


@app.get("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(ROOT / "assets", filename)


@app.get("/api/health")
def health():
    return jsonify(ok=True, service="UnApp")


@app.post("/api/requests")
def project_request():
    if not request.is_json:
        return jsonify(ok=False, message="Надішли дані у форматі JSON."), 415
    try:
        data = request.get_json(silent=True)
    except RecursionError:
        data = None
    if not isinstance(data, dict):
        return jsonify(ok=False, message="Не вдалося прочитати дані заявки."), 400
    errors = validate_request(data)
    if errors:
        return jsonify(ok=False, message="Перевір заповнення полів.", errors=errors), 422
    # No database, file writes, email delivery, or logging of the form values.
    return jsonify(
        ok=True,
        message=(
            "Дані заявки перевірено. Це навчальна форма: звернення не "
            "зберігається та не надсилається менеджеру."
        ),
    )


@app.errorhandler(404)
def missing_route(error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, message="Адресу API не знайдено."), 404
    return not_found_page()


@app.errorhandler(405)
def wrong_method(error):
    if request.path.startswith("/api/"):
        response = jsonify(ok=False, message="Цей спосіб надсилання не підтримується.")
        response.status_code = 405
        response.headers["Allow"] = ", ".join(error.valid_methods or [])
        return response
    return error


@app.errorhandler(RequestEntityTooLarge)
def too_large(error):
    return jsonify(ok=False, message="Завеликий обсяг даних. Скороти текст заявки."), 413


@app.after_request
def response_headers(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8080")), debug=False)
