#!/usr/bin/env python3
"""Parser tests for k6 result loading (no reportlab required)."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from k6_result_parse import k6_log_indicates_threshold_failure, load_results, parse_k6_log


class ParseK6LogTests(unittest.TestCase):
    def test_http_req_failed_metric_name_is_not_a_threshold_breach(self):
        txt = """
     http_req_failed................: 0.00%  ✓ 0.00%
     http_req_duration..............: avg=12ms p(95)=40ms
     checks.........................: 100.00% ✓ 12
"""
        parsed = parse_k6_log(txt)
        self.assertFalse(parsed["failed"], parsed)
        self.assertFalse(k6_log_indicates_threshold_failure(txt))

    def test_detects_real_k6_threshold_cross(self):
        txt = """
ERRO[0030] thresholds on metrics 'http_req_duration{group:::API}' have been crossed
     http_req_failed................: 0.00%
"""
        parsed = parse_k6_log(txt)
        self.assertTrue(parsed["failed"])

    def test_load_results_reads_load_run_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p / "smoke-run-20260826.log").write_text(
                "http_req_duration avg=10ms p(95)=20ms\nhttp_req_failed 0.00%\n",
                encoding="utf-8",
            )
            (p / "load-run-20260826.log").write_text(
                "http_req_duration avg=30ms p(95)=80ms\nhttp_req_failed 0.00%\n",
                encoding="utf-8",
            )
            data = load_results(tmp)
            self.assertTrue(data["sm"])
            self.assertTrue(data["lm"])
            self.assertFalse(data["sm"].get("failed"))
            self.assertFalse(data["lm"].get("failed"))

    def test_load_results_reads_latest_symlink_when_no_timestamped_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p / "load-run-latest.log").write_text(
                "http_req_duration avg=30ms p(95)=80ms\nhttp_req_failed 0.00%\n",
                encoding="utf-8",
            )
            data = load_results(tmp)
            self.assertTrue(data["lm"])
            self.assertEqual(data["lm"].get("p95"), "80ms")

    def test_load_results_falls_back_to_profile_summary_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            load_dir = Path(tmp) / "load"
            load_dir.mkdir()
            (load_dir / "k6-summary.json").write_text(
                '{"sla":{"api_p95_ms":120,"api_p95_pass":true,"error_rate":0,"error_rate_pass":true}}',
                encoding="utf-8",
            )
            data = load_results(tmp)
            self.assertEqual(data["lm"].get("p95"), "120ms")
            self.assertFalse(data["lm"].get("failed"))


if __name__ == "__main__":
    unittest.main()
