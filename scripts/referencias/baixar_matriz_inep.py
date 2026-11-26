"""Download local da matriz oficial do ENEM. Python 3, biblioteca padrão.
Não baixa microdados individuais. Não faz chamadas pagas. Executar na raiz do projeto.
"""
import hashlib, json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'referencias' / 'inep'
URLS = [
    'https://download.inep.gov.br/enem/outros_documentos/enem_matriz_referencia.pdf',
    'https://download.inep.gov.br/download/enem/matriz_referencia.pdf',
]

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    target = DEST / 'matriz_referencia_enem.pdf'
    if target.is_file() and target.read_bytes().startswith(b'%PDF-'):
        print('Matriz local encontrada. Confira edição e integridade antes de uso.'); return
    for url in URLS:
        try:
            with urlopen(Request(url, headers={'User-Agent':'NEXO-reference-fetch/1.0'}), timeout=30) as resp:
                final = resp.geturl()
                host = urlparse(final).hostname or ''
                if urlparse(final).scheme != 'https' or not (host == 'inep.gov.br' or host.endswith('.inep.gov.br')):
                    raise ValueError('Redirecionamento fora do domínio oficial')
                data = resp.read(25*1024*1024+1)
            if not data.startswith(b'%PDF-') or len(data)>25*1024*1024:
                raise ValueError('Resposta não é PDF válido ou supera o limite')
            tmp = target.with_suffix('.tmp'); tmp.write_bytes(data); tmp.replace(target)
            manifest = {'source':url,'resolved_url':final,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'verification_status':'downloaded_pending_review'}
            (DEST/'matriz_manifest.json').write_text(json.dumps(manifest,indent=2), encoding='utf-8')
            print('Matriz baixada. Verifique versão, conteúdo e direitos.'); return
        except Exception as exc:
            print(f'Falha em {url}: {exc}')
    raise SystemExit('Download indisponível. Registrar pendência e continuar tarefas independentes; não inventar matriz.')

if __name__ == '__main__': main()
