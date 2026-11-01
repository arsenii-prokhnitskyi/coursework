import unittest

from app import app


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.valid = {
            "name": "Тестова команда",
            "email": "test@example.com",
            "message": "Плануємо роботу над навчальним проєктом.",
        }

    def test_all_pages_assets_and_health(self):
        for path in ["/", "/index.html", "/blog.html", "/services.html", "/assets/css/style.css", "/assets/js/main.js", "/assets/images/home-icons.svg"]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()
        response = self.client.get("/api/health")
        self.assertTrue(response.json["ok"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_valid_request_does_not_echo_personal_data(self):
        response = self.client.post("/api/requests", json=self.valid)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["ok"])
        self.assertIn("не зберігається", response.json["message"])
        self.assertNotIn(self.valid["email"], response.get_data(as_text=True))

    def test_trimming_and_maximum_lengths(self):
        data = {"name": "  " + "а" * 70 + "  ", "email": " test@example.com ", "message": "  " + "а" * 1000 + "  "}
        self.assertEqual(self.client.post("/api/requests", json=data).status_code, 200)

    def test_missing_blank_and_wrong_type_fields(self):
        for value in [None, "", "  \n ", 7, [], {}]:
            with self.subTest(value=value):
                response = self.client.post("/api/requests", json={key: value for key in self.valid})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(set(response.json["errors"]), set(self.valid))

    def test_length_boundaries_and_emoji_match_html(self):
        for name, value in [("name", "А"), ("name", "а" * 71), ("message", "коротко"), ("message", "а" * 1001), ("message", "😀" * 501), ("email", "a" * 109 + "@example.com")]:
            with self.subTest(field=name, length=len(value)):
                data = {**self.valid, name: value}
                response = self.client.post("/api/requests", json=data)
                self.assertEqual(response.status_code, 422)
                self.assertIn(name, response.json["errors"])

    def test_invalid_email(self):
        for value in ["test", "test@@example.com", "test @example.com", "test@example..com", "test@example.com\nother@example.com"]:
            with self.subTest(email=value):
                response = self.client.post("/api/requests", json={**self.valid, "email": value})
                self.assertEqual(response.status_code, 422)
                self.assertIn("email", response.json["errors"])

    def test_malformed_and_non_object_json(self):
        for raw in ["{bad", "[]", '"text"', "null", "5", "true", "[" * 2000 + "0" + "]" * 2000]:
            with self.subTest(body=raw):
                response = self.client.post("/api/requests", data=raw, content_type="application/json")
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.json["ok"])
        self.assertEqual(self.client.post("/api/requests", data="name=test").status_code, 415)

    def test_body_size_limit(self):
        response = self.client.post("/api/requests", json={**self.valid, "message": "а" * 20000})
        self.assertEqual(response.status_code, 413)
        self.assertFalse(response.json["ok"])

    def test_real_404_and_private_files_are_not_served(self):
        for path in ["/404.html", "/missing", "/missing/nested/path", "/app.py", "/.env", "/README.md", "/docs/prepublication-report.md", "/assets/../app.py"]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)
                self.assertIn("Сторінку не знайдено", response.get_data(as_text=True))
                self.assertIn('<base href="/">', response.get_data(as_text=True))
                response.close()

    def test_api_errors_are_json(self):
        self.assertEqual(self.client.get("/api/missing").status_code, 404)
        response = self.client.get("/api/requests")
        self.assertEqual(response.status_code, 405)
        self.assertFalse(response.json["ok"])
        self.assertIn("POST", response.headers["Allow"])


if __name__ == "__main__":
    unittest.main()
