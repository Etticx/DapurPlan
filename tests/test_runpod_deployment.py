import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

class RunpodDeploymentTests(unittest.TestCase):
    def load_module(self):
        spec=importlib.util.spec_from_file_location('runpod_serve',Path(__file__).resolve().parents[1]/'runpod'/'serve.py')
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_cloud_service_requires_a_strong_key(self):
        module=self.load_module()
        for value in ['', 'short']:
            with patch.dict(os.environ,{'FORECAST_API_KEY':value}):
                with self.assertRaises(RuntimeError): module.create_app()

    def test_cloud_service_rejects_missing_or_wrong_key_and_serves_model(self):
        import json
        module=self.load_module()
        key='local-test-only-key-12345678901234567890'
        with patch.dict(os.environ,{'FORECAST_API_KEY':key}):
            with TestClient(module.create_app()) as client:
                self.assertEqual(client.get('/health').status_code,401)
                self.assertEqual(client.get('/health',headers={'Authorization':'Bearer wrong'}).status_code,401)
                headers={'Authorization':'Bearer '+key}
                self.assertEqual(client.get('/health',headers=headers).status_code,200)
                payload=json.loads((Path(__file__).resolve().parents[1]/'runpod'/'test_input.json').read_text())
                response=client.post('/predict',headers=headers,json=payload)
                self.assertEqual(response.status_code,200)
                self.assertEqual(len(response.json()['predictions']),5)
