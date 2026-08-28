#!/usr/bin/env python3
"""Unit tests for rc-stress-runner helpers (no k6 / AWS required)."""

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("rc_stress_runner", ROOT / "rc-stress-runner.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
sys.modules["rc_stress_runner"] = mod
spec.loader.exec_module(mod)


class ProdGuardTests(unittest.TestCase):
    def test_refuses_live_api_host(self):
        self.assertTrue(mod.is_prod_api_url("https://api.rapidcortex.us"))
        self.assertTrue(mod.is_prod_api_url("https://app.rapidcortex.us/api"))

    def test_allows_staging_execute_api(self):
        self.assertFalse(
            mod.is_prod_api_url("https://ubartq53a8.execute-api.us-east-1.amazonaws.com")
        )


class ApiIdTests(unittest.TestCase):
    def test_extracts_http_api_id_from_execute_api_url(self):
        self.assertEqual(
            mod.api_id_from_url("https://abc123.execute-api.us-east-1.amazonaws.com"),
            "abc123",
        )

    def test_custom_domain_has_no_id(self):
        self.assertEqual(mod.api_id_from_url("https://api-staging.rapidcortex.us"), "")


class SlaTests(unittest.TestCase):
    def test_hard_stop_on_5xx(self):
        with self.assertRaises(mod.SLABreach):
            mod.check_sla({"gw_5xx": 1, "ddb_throttles": 0, "lambda_errors": 0}, 0)

    def test_consecutive_p99_warns_then_breaches(self):
        cw = {
            "gw_5xx": 0,
            "ddb_throttles": 0,
            "lambda_errors": 0,
            "gw_lat_p99_ms": 2500,
        }
        self.assertEqual(mod.check_sla(cw, 0), 1)
        with self.assertRaises(mod.SLABreach):
            mod.check_sla(cw, 1)

    def test_clean_interval_resets_warn_count(self):
        self.assertEqual(
            mod.check_sla(
                {"gw_5xx": 0, "ddb_throttles": 0, "lambda_errors": 0, "gw_lat_p99_ms": 40},
                1,
            ),
            0,
        )


class K6MetricsTests(unittest.TestCase):
    def test_extracts_counts_and_threshold_breaches(self):
        summary = {
            "metrics": {
                "http_reqs": {"values": {"count": 10}},
                "http_req_failed": {"values": {"rate": 0.02}},
                "http_req_duration": {"values": {"p(50)": 12, "p(99)": 40, "avg": 15}},
                "server_errors": {"values": {"count": 0}},
                "http_req_duration{scenario:sustained}": {
                    "thresholds": {"p(99)<500": {"ok": False}}
                },
            }
        }
        m = mod.extract_k6_metrics(summary)
        self.assertEqual(m["total_reqs"], 10)
        self.assertEqual(m["fail_rate_pct"], 2.0)
        self.assertIn("http_req_duration{scenario:sustained}", m["breaches"])


if __name__ == "__main__":
    unittest.main()
