import unittest
import json
from app import app, build_rich_persona

class TestIdentityEngine(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_home_endpoint(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("endpoints", data)
        self.assertEqual(data.get("version"), "1.2")

    def test_rich_persona_generation(self):
        response = self.client.get('/generate')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        
        required_keys = [
            "name", "first_name", "last_name", "email", "username",
            "phone", "job", "company", "address", "city", "state", "zipcode", "country"
        ]
        for key in required_keys:
            self.assertIn(key, data)
            self.assertTrue(len(str(data[key])) > 0)
        
        self.assertIn("@shieldmail.dev", data["email"])

    def test_domain_consistency(self):
        persona_a1 = build_rich_persona(domain="amazon.com")
        persona_a2 = build_rich_persona(domain="amazon.com")
        persona_b = build_rich_persona(domain="reddit.com")
        
        # Consistent for same domain
        self.assertEqual(persona_a1["name"], persona_a2["name"])
        self.assertEqual(persona_a1["email"], persona_a2["email"])
        
        # Unique across different domains
        self.assertNotEqual(persona_a1["name"], persona_b["name"])

    def test_encrypted_vault_ingestion(self):
        payload = {
            "real_name": "[Encrypted] Satoshi*",
            "proof_hash": "0x5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
            "encrypted_bundle": {
                "ciphertext": "a1b2c3d4e5f6",
                "salt": "0102030405060708",
                "iv": "010203040506",
                "algorithm": "AES-256-GCM"
            }
        }
        
        response = self.client.post('/generate', json=payload)
        # Even without Pinata credentials, gracefully responds with status or error code
        self.assertIn(response.status_code, [200, 500])
        data = response.get_json()
        self.assertIn("fake_identity", data)

    def test_telemetry_logs(self):
        self.client.get('/generate?domain=github.com')
        response = self.client.get('/logs')
        self.assertEqual(response.status_code, 200)
        logs = response.get_json()
        self.assertIsInstance(logs, list)
        self.assertTrue(len(logs) > 0)
        self.assertIn("event", logs[-1])
        self.assertIn("github.com", logs[-1]["event"])

if __name__ == '__main__':
    unittest.main()
