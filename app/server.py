#!/usr/bin/env python3
"""Serve StringScape with a same-origin bridge to the ESM Atlas read API.

Run: python3 server.py --port 8000
Open http://127.0.0.1:8000/ . No third-party Python packages are required.
"""
import argparse
import json
import re
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qs, urlencode
from urllib.request import Request, urlopen

APP_ROOT = Path(__file__).resolve().parent
ATLAS_ROUTE = '/api/esm-atlas/proteins/'


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/ncbi/report/'):
            return self.send_ncbi_report(path.removeprefix('/api/ncbi/report/'))
        if path.startswith('/api/ncbi/genome/'):
            return self.send_genome(path.removeprefix('/api/ncbi/genome/'))
        if not path.startswith(ATLAS_ROUTE):
            return super().do_GET()
        protein_hash = path[len(ATLAS_ROUTE):]
        if not re.fullmatch(r'[a-f0-9]{32}', protein_hash):
            return self.send_json(400, {'error': 'Expected an exact sequence MD5 hash.'})
        # The caller cannot choose a host, path, or query, or trigger upstream folding.
        endpoint = ('https://biohub.ai/esm/protein/api/v1alpha1/proteins/'
                    f'{protein_hash}?fold_on_miss=false&topk_features=1')
        try:
            request = Request(endpoint, headers={'Accept': 'application/json'})
            with urlopen(request, timeout=10) as response:
                body = response.read(16 * 1024 * 1024 + 1)
            if len(body) > 16 * 1024 * 1024:
                return self.send_json(502, {'error': 'Atlas response exceeds the size limit.'})
            payload = json.loads(body)
            if not isinstance(payload, dict):
                raise ValueError('Invalid Atlas record')
            # Forward only the fields needed to check identity and view the structure.
            fields = ('protein_hash', 'sequence', 'pdb', 'folded_on_demand')
            self.send_json(200, {key: payload[key] for key in fields if key in payload})
        except HTTPError as error:
            self.send_json(404 if error.code == 404 else 502,
                           {'error': f'Atlas returned HTTP {error.code}.'})
        except (URLError, TimeoutError, OSError, ValueError):
            self.send_json(502, {'error': 'Atlas lookup is temporarily unavailable.'})

    def send_ncbi_report(self, route):
        kind, _, identifier = route.partition('/')
        numeric = r'\d+(?:,\d+){0,4}' if kind == 'gene' else r'\d+'
        valid = (kind in ('gene', 'taxon') and re.fullmatch(numeric, identifier)) or (
            kind == 'assembly' and re.fullmatch(r'GC[AF]_\d{9}\.\d+(?:,GC[AF]_\d{9}\.\d+){0,19}', identifier))
        if not valid:
            return self.send_json(400, {'error': 'Invalid NCBI report identifier.'})
        query = 'filters.has_annotation=true&filters.assembly_version=current&filters.exclude_paired_reports=true&page_size=100'
        if kind == 'gene':
            path = f'gene/id/{identifier}/dataset_report?page_size=5'
        elif kind == 'assembly':
            path = f'genome/accession/{identifier}/dataset_report?{query}'
        else:
            reference = parse_qs(urlsplit(self.path).query).get('reference', ['true'])[0] == 'true'
            scope = 'filters.reference_only=true' if reference else 'tax_exact_match=true'
            path = f'genome/taxon/{identifier}/dataset_report?{query}&{scope}'
        try:
            request = Request('https://api.ncbi.nlm.nih.gov/datasets/v2/' + path,
                              headers={'Accept': 'application/json'})
            with urlopen(request, timeout=30) as response:
                body = response.read(16 * 1024 * 1024 + 1)
            if len(body) > 16 * 1024 * 1024:
                return self.send_json(502, {'error': 'NCBI report exceeds the size limit.'})
            payload = json.loads(body)
            if not isinstance(payload, dict):
                raise ValueError('Invalid NCBI report')
            self.send_json(200, payload)
        except HTTPError as error:
            self.send_json(502, {'error': f'NCBI returned HTTP {error.code}.'})
        except (URLError, TimeoutError, OSError, ValueError):
            self.send_json(502, {'error': 'NCBI assembly lookup is temporarily unavailable.'})

    def send_genome(self, accession):
        if not re.fullmatch(r'GC[AF]_\d{9}\.\d+', accession):
            return self.send_json(400, {'error': 'Expected a versioned NCBI assembly accession.'})
        endpoint = (f'https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/{accession}/download'
                    '?include_annotation_type=GENOME_FASTA&include_annotation_type=GENOME_GFF'
                    '&include_annotation_type=SEQUENCE_REPORT&hydrated=FULLY_HYDRATED')
        chromosomes = parse_qs(urlsplit(self.path).query).get('chromosomes', [])
        if len(chromosomes) > 64 or any(not re.fullmatch(r'[A-Za-z0-9_.-]{1,40}', c) for c in chromosomes):
            return self.send_json(400, {'error': 'Invalid chromosome names.'})
        if chromosomes:
            endpoint += '&' + urlencode({'chromosomes': chromosomes}, doseq=True)
        limit = 512 * 1024 * 1024
        try:
            request = Request(endpoint, headers={'Accept': 'application/zip'})
            # Spool to disk so a genome package cannot occupy the server's entire RAM.
            with tempfile.TemporaryFile() as package:
                size = 0
                with urlopen(request, timeout=120) as response:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > limit:
                            return self.send_json(413, {'error': 'Genome ZIP exceeds the 512 MiB import limit.'})
                        package.write(chunk)
                package.seek(0)
                if package.read(4) != b'PK\x03\x04':
                    return self.send_json(502, {'error': 'NCBI did not return a genome ZIP.'})
                package.seek(0)
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Length', str(size))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                while chunk := package.read(1024 * 1024):
                    self.wfile.write(chunk)
        except HTTPError as error:
            self.send_json(404 if error.code == 404 else 502,
                           {'error': f'NCBI returned HTTP {error.code}.'})
        except (URLError, TimeoutError, OSError):
            self.send_json(502, {'error': 'NCBI genome download is temporarily unavailable.'})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    handler = partial(AppHandler, directory=str(APP_ROOT))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'StringScape: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
