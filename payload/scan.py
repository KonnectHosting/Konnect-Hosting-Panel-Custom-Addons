#!/usr/bin/env python3
"""Bounded, offline GLua heuristics. Never import, compile or execute scanned Lua."""
import base64
import json
import lzma
import os
import re
import resource
import signal
import stat
import struct
import sys
import tempfile
import zlib
from dataclasses import dataclass

RULES_VERSION = '2026.11.07.2'
MAX_SCRIPT = 2 * 1024 * 1024
MAX_ARCHIVE = 1024 * 1024 * 1024
MAX_FINDINGS = 30
PRIORITY = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
HISTORICAL_CHANNELS = {'bdsm', 'LickMeOut', 'MoonMan', 'Sbox_gm_attackofnullday_key',
                       'OdiumBackDoor', 'SessionBackdoor', 'DefqonBackdoor', 'ZimbaBackDoor'}
HISTORICAL_CHANNELS = {name.lower() for name in HISTORICAL_CHANNELS}
EXEC = {'RunString', 'RunStringEx', 'CompileString', 'CompileFile', 'loadstring', 'load', 'BroadcastLua', 'SendLua'}
HTTP = {'http.Fetch', 'http.Post', 'HTTP'}
NETWORK = {'net.ReadString', 'net.ReadData', 'net.ReadTable', 'net.ReadType'}
PRIVILEGE = {'SetUserGroup', 'SetRank', 'SetAccess', 'ULib.ucl.addUser', 'ULib.ucl.addGroup', 'sam.player.set_rank'}


@dataclass
class Token:
    kind: str
    value: str
    line: int


def lex(text):
    """GLua-aware lexical scan: comments and strings cannot masquerade as calls."""
    tokens = []
    p = 0
    line = 1
    while p < len(text):
        start = p
        char = text[p]
        if char.isspace():
            line += char == '\n'
            p += 1
            continue
        comment = text.startswith('--', p) or text.startswith('//', p)
        if comment or text.startswith('/*', p):
            offset = p + 2
            bracket = re.match(r'\[(=*)\[', text[offset:offset + 40]) if text.startswith('--', p) else None
            if bracket:
                end = text.find(']' + bracket[1] + ']', offset + len(bracket[0]))
                p = len(text) if end < 0 else end + len(bracket[1]) + 2
            elif text.startswith('/*', p):
                end = text.find('*/', offset)
                p = len(text) if end < 0 else end + 2
            else:
                end = text.find('\n', offset)
                p = len(text) if end < 0 else end
            line += text[start:p].count('\n')
            continue
        bracket = re.match(r'\[(=*)\[', text[p:p + 40]) if char == '[' else None
        if bracket:
            end = text.find(']' + bracket[1] + ']', p + len(bracket[0]))
            stop = len(text) if end < 0 else end
            tokens.append(Token('str', text[p + len(bracket[0]):stop][:65536], line))
            p = len(text) if end < 0 else end + len(bracket[1]) + 2
        elif char in "\"'":
            p += 1
            out = []
            while p < len(text) and text[p] != char:
                if text[p] == '\\' and p + 1 < len(text):
                    p += 1
                    match = re.match(r'[0-9]{1,3}', text[p:p + 3])
                    if match:
                        out.append(chr(int(match[0]) % 256)); p += len(match[0]); continue
                    if text[p] == 'x' and re.fullmatch('[a-fA-F0-9]{2}', text[p + 1:p + 3]):
                        out.append(chr(int(text[p + 1:p + 3], 16))); p += 3; continue
                    out.append({'n': '\n', 'r': '\r', 't': '\t'}.get(text[p], text[p])); p += 1
                else:
                    out.append(text[p]); p += 1
            p = min(p + 1, len(text))
            tokens.append(Token('str', ''.join(out)[:65536], line))
        else:
            match = re.match(r'[A-Za-z_][A-Za-z_0-9]*|[0-9]+|\.\.|==|~=|!=|&&|\|\|', text[p:p + 512])
            value = match[0] if match else char
            tokens.append(Token('id' if re.fullmatch('[A-Za-z_][A-Za-z_0-9]*', value) else 'op', value, line))
            p += len(value)
        line += text[start:p].count('\n')
        if len(tokens) > 250000:
            raise ValueError('Script exceeds the lexical token limit.')
    return tokens


def normalize(tokens):
    # Fold only literal strings/character lists; no Lua interpreter or general evaluator.
    for _ in range(4):
        output = []
        i = 0
        while i < len(tokens):
            t = tokens[i]
            tail = tokens[i:i + 5]
            vals = [x.value for x in tail]
            if len(tail) >= 3 and t.kind == 'str' and vals[1] == '..' and tail[2].kind == 'str':
                output.append(Token('str', (t.value + tail[2].value)[:65536], t.line)); i += 3; continue
            if len(tail) == 5 and vals[:3] == ['string', '.', 'reverse'] and vals[3] == '(':
                if i + 5 < len(tokens) and tail[4].kind == 'str' and tokens[i + 5].value == ')':
                    output.append(Token('str', tail[4].value[::-1], t.line)); i += 6; continue
            if len(tail) >= 4 and vals[:4] == ['string', '.', 'char', '(']:
                j = i + 4
                chars = []
                while j < min(len(tokens), i + 132) and tokens[j].value.isdigit():
                    chars.append(chr(int(tokens[j].value) % 256)); j += 1
                    if j < len(tokens) and tokens[j].value == ',': j += 1
                    else: break
                if chars and j < len(tokens) and tokens[j].value == ')':
                    output.append(Token('str', ''.join(chars), t.line)); i = j + 1; continue
            if len(tail) >= 4 and t.kind == 'id' and vals[1] == '[' and tail[2].kind == 'str' and vals[3] == ']' and re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', vals[2]):
                output.extend([t, Token('op', '.', t.line), Token('id', vals[2], tail[2].line)]); i += 4; continue
            output.append(t); i += 1
        tokens = output
    return tokens


def analyze(raw, member=''):
    issues = []
    findings = []
    if raw.startswith((b'\x1bLua', b'\x1bLJ')):
        return [], ['Lua bytecode cannot be statically inspected.'], True
    text = raw.decode('utf-8', 'replace')
    lines = text.splitlines() or ['']
    original = lex(text)
    indirect_exec = {t.value for t in original if t.kind == 'str' and t.value in EXEC}
    tokens = normalize(original)
    aliases = {}
    calls = []
    values = [t.value if t.kind != 'str' else None for t in tokens]
    # Parenthesis pairing bounds callback searches; unrelated functions elsewhere
    # in a large file do not by themselves prove a remote-execution chain.
    stack = []
    ends = {}
    for i, t in enumerate(tokens):
        if t.kind != 'str' and t.value == '(': stack.append(i)
        elif t.kind != 'str' and t.value == ')' and stack: ends[stack.pop()] = i
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.kind != 'id': i += 1; continue
        j = i + 1
        path = [t.value]
        while j + 1 < len(tokens) and tokens[j].kind != 'str' and tokens[j].value in ('.', ':') and tokens[j + 1].kind == 'id':
            path.append(tokens[j + 1].value); j += 2
        name = '.'.join(path)
        name = aliases.get(path[0], path[0]) + ('.' + '.'.join(path[1:]) if len(path) > 1 else '')
        if name.startswith('_G.'): name = name[3:]
        if j < len(tokens) and values[j] == '=' and j + 1 < len(tokens) and tokens[j + 1].kind == 'id':
            k = j + 2; rhs = [tokens[j + 1].value]
            while k + 1 < len(tokens) and values[k] == '.' and tokens[k + 1].kind == 'id': rhs.append(tokens[k + 1].value); k += 2
            if k >= len(tokens) or values[k] != '(':
                target = aliases.get(rhs[0], rhs[0]) + ('.' + '.'.join(rhs[1:]) if len(rhs) > 1 else '')
                aliases[path[0]] = target.removeprefix('_G.')
        if j < len(tokens) and values[j] == '(' and j in ends:
            calls.append({'name': name, 'line': t.line, 'start': i, 'open': j, 'end': ends[j]})
            if name in {'pcall', 'xpcall'}:
                k = j + 1; target = []
                while k < ends[j] and tokens[k].value != ',':
                    target.append(tokens[k].value); k += 1
                target = ''.join(target).removeprefix('_G.')
                target = aliases.get(target, target)
                if target in EXEC:
                    calls.append({'name': target, 'line': t.line, 'start': i, 'open': j, 'end': ends[j]})
        i = j
        if len(calls) > 5000:
            raise ValueError('Script exceeds the static call-analysis limit.')
    seen = set()
    sources = {}
    for call in calls:
        pos = call['start']
        if call['name'] in NETWORK | {'file.Read'} and pos >= 2 and values[pos - 1] == '=' and tokens[pos - 2].kind == 'id':
            sources[tokens[pos - 2].value] = (call['name'], pos)

    def add(rule, severity, title, description, line, evidence=None):
        key = (rule, line)
        if key in seen: return
        seen.add(key)
        context = [{'line': n + 1, 'text': re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '?', lines[n])[:240]}
                   for n in range(max(0, line - 2), min(len(lines), line + 1))]
        finding = {'rule': rule, 'severity': severity, 'title': title, 'description': description,
                   'line': line, 'context': context, 'member': member, 'evidence': (evidence or '')[:160]}
        if len(findings) < MAX_FINDINGS: findings.append(finding)
        else:
            worst = max(range(len(findings)), key=lambda i: PRIORITY[findings[i]['severity']])
            if PRIORITY[severity] < PRIORITY[findings[worst]['severity']]: findings[worst] = finding

    def inside(outer, names):
        return [c for c in calls if outer['open'] < c['start'] < outer['end'] and (c['name'] in names or c['name'].split('.')[-1] in names)]

    def strings(call): return [t.value for t in tokens[call['open'] + 1:call['end']] if t.kind == 'str']

    for call in calls:
        name = call['name']; short = name.split('.')[-1]; line = call['line']
        args = tokens[call['open'] + 1:call['end']]
        literals = strings(call)
        if name in EXEC or short == 'SendLua':
            if name in indirect_exec or re.search(r'_G\s*\[|\\(?:[0-9]{2,3}|x[0-9a-fA-F]{2})|string\s*\.\s*(?:char|reverse)', lines[min(line - 1, len(lines) - 1)]):
                add('indirect-execution', 'high', 'Indirect or encoded execution call', 'The scanner resolved a concealed or indexed Lua execution function. Review its argument and authorization; literal folding does not evaluate Lua.', line, name)
            direct = inside(call, NETWORK)
            variables = [sources[t.value][0] for t in args if t.kind == 'id' and t.value in sources and sources[t.value][1] < call['start']]
            if direct:
                add('network-execution', 'critical', 'Network input is executed as Lua', 'A network read feeds a Lua execution function. An exposed server receiver can give its sender control of the server.', line, direct[0]['name'] + ' → ' + name)
            elif any(value in NETWORK for value in variables):
                add('network-execution', 'high', 'Network-derived value may execute as Lua', 'A simple assignment links a network-read variable to Lua execution. Review scope and sender authorization; this limited analysis is not a complete data-flow proof.', line)
            elif inside(call, {'file.Read'}) or 'file.Read' in variables:
                add('file-execution', 'high', 'File content is executed as Lua', 'Inspect who can write the loaded file. Data or material files can conceal a second-stage payload.', line)
            else:
                add('dynamic-lua', 'medium', 'Dynamic Lua execution', 'This executes or compiles Lua supplied at runtime. Admin tools and legitimate loaders also use it; inspect the source of the value.', line, name)
        if name in HTTP:
            sinks = inside(call, EXEC | {'SendLua'})
            # Passing RunString directly as a callback also executes response data.
            callback = any(t.kind == 'id' and aliases.get(t.value, t.value) in EXEC for t in args)
            if sinks or callback:
                add('http-execution', 'high', 'Remote response may execute as Lua', 'A web request contains an execution callback. A compromised endpoint can replace its response with server code. Review the value flow; this is a heuristic.', line)
            else:
                add('http-request', 'low', 'External HTTP request', 'HTTP requests are common in updates, loading screens and integrations. Review the destination only when other evidence makes it suspicious.', line)
            if any(re.search(r'rcon_password|sv_password|server\.cfg|users\.txt|sv\.db|password|api[_-]?key|token', t.value, re.I) for t in args if t.kind == 'str'):
                add('possible-exfiltration', 'high', 'Web request includes potentially private data', 'Review the posted/read values for credentials, configuration or player data. The request may be a legitimate integration.', line)
        if name in {'net.Receive', 'concommand.Add'}:
            if inside(call, EXEC):
                add('remote-handler-execution', 'high', 'Command or network handler executes Lua', 'Verify server-side sender authorization and the value passed to execution. An admin check elsewhere in the file does not secure this callback.', line)
            if inside(call, PRIVILEGE) or any(re.search(r'(?i)\b(?:superadmin|adduser(?:id)?|setrank|setaccess)\b', v) for v in literals):
                add('remote-privilege', 'high', 'Remote handler can change privileges', 'Review whether the actual sender is authorized before privileges or administrative commands are changed.', line)
            if name == 'net.Receive' and any(v.lower() in HISTORICAL_CHANNELS for v in literals[:1]):
                add('historical-channel', 'high', 'Historically reported backdoor channel', 'This registered receiver uses a channel reported in historical GMod backdoor incidents/tools. Names can be reused; verify its callback before deciding it is malicious.', line, literals[0])
        if name == 'util.AddNetworkString' and literals and literals[0].lower() in HISTORICAL_CHANNELS:
            add('historical-channel', 'medium', 'Historically reported network channel', 'This channel name has appeared in historical backdoors. Registration alone does not prove a backdoor, particularly in protection addons.', line, literals[0])
        if short in PRIVILEGE or name in PRIVILEGE:
            start = max(0, call['start'] - 100)
            window = tokens[start:call['end']]
            identity = any(t.kind == 'str' and re.fullmatch(r'STEAM_[0-5]:[01]:[0-9]+|7656119[0-9]{10}', t.value) for t in window)
            add('identity-privilege' if identity else 'privilege-change', 'high' if identity else 'medium', 'Hardcoded identity near a privilege grant' if identity else 'Player privilege change', 'A fixed Steam identity near an admin grant can hide author access, as in historical addon abuse. Confirm intent and authorization.' if identity else 'Legitimate administration addons change ranks too. Review who can trigger this call and which account receives the rank.', line, name)
        if name in {'RunConsoleCommand', 'game.ConsoleCommand'} or short == 'ConCommand':
            if any(re.search(r'(?i)(?:\bulx\b|\bulib\b|\bsam\b|\bfadmin\b|\bsuperadmin\b|\badduserid\b|\bsetrank\b)', v) for v in literals):
                add('admin-command', 'high' if any('STEAM_' in v for v in literals) else 'medium', 'Administrative console command', 'Review the target user, requested rank and caller authorization. This may be an intentional admin feature.', line)
            if any(re.search(r'(?i)\b(?:lua_run(?:_cl)?|rcon_password)\b', v) for v in literals) or inside(call, NETWORK):
                add('console-execution', 'high', 'Sensitive or network-controlled console command', 'A console command can execute code or change sensitive server settings. Check its source and sender checks.', line)
        if name in {'file.Write', 'file.Append'} and any(re.search(r'(?i)(?:\.lua\b|autorun|users\.txt|server\.cfg)', v) for v in literals):
            add('persistent-write', 'medium', 'Script or privilege-related file write', 'Review whether this writes a loader, startup script or privilege data. Normal addon persistence can also match.', line)
        if name in {'file.Write', 'file.Append'}:
            copied = inside(call, {'file.Read'}) or any(t.kind == 'id' and t.value in sources and sources[t.value][0] == 'file.Read' and sources[t.value][1] < call['start'] for t in args)
            script_path = any(re.search(r'(?i)\.lua\b|autorun|addons/', value) for value in literals)
            self_source = any(c['name'] == 'debug.getinfo' for c in calls)
            if copied and (script_path or self_source):
                add('code-propagation', 'high', 'Script content is copied to another file', 'Read script data flows into a file write, or source-introspection and copying occur together. Inspect targets and loops for self-copying loaders. Installers/backups can also match; this is static evidence, not proof of runtime spread.', line)
        if name in {'os.execute', 'io.popen', 'package.loadlib', 'ffi.load'}:
            add('native-execution', 'high', 'Native code or operating-system access', 'Native modules can bypass Lua-level restrictions. Their binary content is outside this static Lua analysis.', line)
        if name == 'require' and literals and literals[0] not in {'hook', 'concommand', 'cvars', 'timer', 'net', 'usermessage', 'http', 'properties', 'widgets', 'drive', 'cookie', 'utf8', 'jit', 'bit'}:
            add('native-module', 'medium', 'Additional module loaded', 'Review the provenance of this module. A Lua scan cannot establish whether an accompanying native binary is safe.', line, literals[0])
        if name in {'util.Base64Decode', 'util.Decompress', 'string.char', 'string.reverse'}:
            if any(c['name'] in EXEC for c in calls):
                add('encoded-loader', 'high', 'Encoded data alongside Lua execution', 'Encoding and execution occur in this script. Check whether the decoded value reaches execution; they may belong to separate legitimate code paths.', line)
    for i in range(max(0, len(tokens) - 2)):
        if tokens[i].kind == 'id' and tokens[i].value in {'IsAdmin', 'IsSuperAdmin', 'CheckGroup', 'UserHasAccess'} and (values[i + 1:i + 3] == ['=', 'function'] or (i >= 3 and values[i - 3] == 'function' and values[i - 1] in ('.', ':'))):
            add('authorization-override', 'high', 'Authorization function is replaced', 'Replacing an admin or permission check can grant hidden privileges. Verify the replacement and which player/metatable it affects.', tokens[i].line)
        if tokens[i].kind == 'str' and re.fullmatch(r'STEAM_[0-5]:[01]:[0-9]+|7656119[0-9]{10}', tokens[i].value):
            nearby = values[max(0, i - 12):min(len(tokens), i + 50)]
            if any(nearby[j:j + 2] == ['return', 'true'] for j in range(len(nearby) - 1)) and any(v in ('==', '~=', '!=') for v in nearby):
                add('identity-bypass', 'high', 'Hardcoded identity near an allow decision', 'A fixed Steam identity is checked close to an unconditional allow. This may be an intended whitelist or concealed author access; inspect the surrounding hook/permission logic.', tokens[i].line)
        if tokens[i].kind == 'id' and tokens[i].value in {'group', 'rank'} and values[i + 1] == '=':
            nearby = tokens[max(0, i - 30):i]
            if any(t.value in {'ULib', 'FAdmin', 'sam'} and t.kind == 'id' for t in nearby):
                add('privilege-table-write', 'medium', 'Administration rank table is modified', 'Direct writes to administration data can bypass normal rank commands. Review the target identity and authorization; framework internals also use these tables.', tokens[i].line)
    if any(t.value in {'_G', 'getfenv', 'setfenv', 'debug'} for t in tokens if t.kind == 'id'):
        line = next(t.line for t in tokens if t.value in {'_G', 'getfenv', 'setfenv', 'debug'} and t.kind == 'id')
        add('environment-access', 'low', 'Global or debug environment access', 'These APIs are also used by normal Lua libraries. Inspect indirect calls when other findings indicate a loader or authorization bypass.', line)
    if re.search('[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]', text.lstrip('\ufeff')):
        add('hidden-unicode', 'medium', 'Invisible or directional Unicode in source', 'Hidden characters can disguise names or change how source is displayed. Localization and text literals can also contain them.', 1)
    # Decode small, literal Base64 strings as data only. Keep original source lines.
    for call in calls:
        if call['name'] == 'util.Base64Decode' and strings(call):
            try:
                decoded = base64.b64decode(strings(call)[0], validate=True)
                if len(decoded) <= 65536 and re.search(rb'RunString|CompileString|net\.Receive|SetUserGroup|http\.Fetch', decoded):
                    add('encoded-payload', 'high', 'Encoded string contains loader or privilege APIs', 'Literal Base64 decoding exposes Lua-sensitive API names. The decoded text was inspected as data and was never executed.', call['line'])
            except (ValueError, TypeError): pass
    return sorted(findings, key=lambda item: (PRIORITY[item['severity']], item['line'])), issues, len(seen) > MAX_FINDINGS


def scan_file(path, kind):
    result = {'rulesVersion': RULES_VERSION, 'findings': [], 'issues': [], 'scripts': 0, 'bytes': 0, 'truncated': False}

    def inspect(raw, member=''):
        try:
            found, issues, clipped = analyze(raw, member)
            result['scripts'] += 1; result['bytes'] += len(raw)
            result['findings'].extend(found)
            result['truncated'] |= clipped or len(result['findings']) > MAX_FINDINGS
            result['findings'].sort(key=lambda item: PRIORITY[item['severity']])
            del result['findings'][MAX_FINDINGS:]
            result['issues'].extend({'member': member, 'reason': message} for message in issues)
        except ValueError as error:
            result['issues'].append({'member': member, 'reason': str(error)})

    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_ARCHIVE:
            raise ValueError('Unsafe or oversized scan input.')
        if kind == 'file':
            raw = stream.read(MAX_SCRIPT + 1)
            if len(raw) > MAX_SCRIPT: raise ValueError('File exceeds the 2 MiB analysis limit.')
            inspect(raw)
            return result
        # Workshop .bin/.gma can be LZMA-alone compressed. Bound both dictionary
        # allocation and output, and never extract archive paths to the filesystem.
        if stream.read(4) != b'GMAD':
            stream.seek(0)
            decoder = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE, memlimit=64 * 1024 * 1024)
            with tempfile.TemporaryFile() as unpacked:
                total = 0
                while not decoder.eof:
                    chunk = stream.read(65536) if decoder.needs_input else b''
                    if not chunk and decoder.needs_input: raise ValueError('Unsupported, truncated or non-GMA Workshop archive.')
                    data = decoder.decompress(chunk, max_length=min(1048576, MAX_ARCHIVE + 1 - total))
                    total += len(data)
                    if total > MAX_ARCHIVE: raise ValueError('Compressed archive exceeds the expanded size limit.')
                    unpacked.write(data)
                unpacked.seek(0); scan_gma(unpacked, total, result, inspect)
        else:
            stream.seek(0); scan_gma(stream, info.st_size, result, inspect)
    return result


def scan_gma(stream, size, result, inspect):
    def read(n):
        value = stream.read(n)
        if len(value) != n: raise ValueError('Truncated GMA archive.')
        return value

    def string(limit=65536):
        value = bytearray()
        while len(value) <= limit:
            ch = read(1)
            if ch == b'\0': return value.decode('utf-8', 'replace')
            value.extend(ch)
        raise ValueError('GMA header string exceeds the limit.')

    if read(4) != b'GMAD': raise ValueError('Unsupported archive format; no code was inspected.')
    version = read(1)[0]
    if version not in (1, 2, 3): raise ValueError('Unsupported GMA version.')
    read(16)
    if version > 1:
        if string() != '': raise ValueError('GMA required-content header is unsupported.')
    string(); string(); string(); read(4)
    entries = []
    total = 0
    while True:
        number = struct.unpack('<I', read(4))[0]
        if not number: break
        if len(entries) >= 50000: raise ValueError('GMA entry limit exceeded.')
        name = string(512)
        length, crc = struct.unpack('<QI', read(12))
        if length > size or total + length > size: raise ValueError('Invalid GMA entry size.')
        entries.append((name, length, crc)); total += length
    offset = stream.tell()
    if offset + total > size - 4: raise ValueError('GMA file table exceeds archive bounds.')
    for name, length, crc in entries:
        safe = not name.startswith(('/', '\\')) and '\\' not in name and not any(ord(ch) < 32 or ord(ch) == 127 for ch in name) and all(p not in ('', '.', '..') for p in name.split('/'))
        lua = name.lower().endswith(('.lua', '.txt', '.vmt', '.cfg', '.dat', '.json'))
        if not safe:
            if len(result['issues']) < 100: result['issues'].append({'member': name[:512], 'reason': 'Unsafe archive member name; not inspected.'})
        elif lua:
            if length > MAX_SCRIPT:
                if len(result['issues']) < 100: result['issues'].append({'member': name, 'reason': 'Archive member exceeds the 2 MiB analysis limit.'})
            elif result['bytes'] + length > 64 * 1024 * 1024 or result['scripts'] >= 5000:
                result['issues'].append({'member': '', 'reason': 'Archive analysis byte/file limit reached.'}); break
            else:
                stream.seek(offset); raw = read(length)
                if zlib.crc32(raw) != crc:
                    if len(result['issues']) < 100: result['issues'].append({'member': name, 'reason': 'GMA member checksum mismatch.'})
                inspect(raw, name)
        elif name.lower().endswith(('.dll', '.so', '.gma', '.zip', '.vpk')) and len(result['issues']) < 100:
            result['issues'].append({'member': name, 'reason': 'Nested archive or native binary cannot be inspected as Lua.'})
        offset += length


def main():
    resource.setrlimit(resource.RLIMIT_CPU, (18, 18))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_ARCHIVE + 1048576, MAX_ARCHIVE + 1048576))
    signal.alarm(22)
    try:
        if len(sys.argv) != 3 or sys.argv[2] not in ('file', 'archive'): raise ValueError('Invalid scan request.')
        result = scan_file(sys.argv[1], sys.argv[2])
    except (ValueError, OSError, lzma.LZMAError, MemoryError) as error:
        result = {'rulesVersion': RULES_VERSION, 'findings': [], 'scripts': 0, 'bytes': 0, 'truncated': False,
                  'issues': [{'member': '', 'reason': str(error)[:200] or 'Analysis resource limit reached.'}]}
    print(json.dumps(result, ensure_ascii=True, separators=(',', ':')))


if __name__ == '__main__': main()
