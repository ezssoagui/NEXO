import { describe, expect, it } from 'vitest';
import { dedupeExtraAssets, parseEnemMarkdown, stripMarkdownImages } from '../../src/components/EnemMedia';
import { buildPageRange } from '../../src/components/Pagination';

describe('EnemMedia: parsing de Markdown com imagens e deduplicação de anexos', () => {
  it('separa texto e imagens inline preservando a ordem original', () => {
    const md = 'Texto antes.\n\n![Gráfico 1](/api/assets/aaa.png)\n\nTexto depois.\n\n![](/api/assets/bbb.jpg)';
    const segments = parseEnemMarkdown(md);
    expect(segments).toHaveLength(4);
    expect(segments[0]).toEqual({ type: 'text', text: 'Texto antes.\n\n' });
    expect(segments[1]).toEqual({ type: 'image', alt: 'Gráfico 1', src: '/api/assets/aaa.png' });
    expect(segments[2]).toEqual({ type: 'text', text: '\n\nTexto depois.\n\n' });
    expect(segments[3]).toEqual({ type: 'image', alt: '', src: '/api/assets/bbb.jpg' });
  });

  it('remove dos anexos extras qualquer imagem já renderizada inline no enunciado', () => {
    const md = 'Veja a figura ![Fig](/api/assets/aaa.png) acima.';
    const extra = dedupeExtraAssets(md, [
      '/api/assets/aaa.png',
      '/api/assets/bbb.png',
      '/api/assets/bbb.png',
    ]);
    expect(extra).toEqual(['/api/assets/bbb.png']);
  });

  it('limpa marcações de imagem para exibir resumo legível na lista do catálogo', () => {
    const md = 'Observe a charge: ![Charge](/api/assets/c.png) O autor critica o consumo.';
    expect(stripMarkdownImages(md)).toBe('Observe a charge: O autor critica o consumo.');
  });
});

describe('Pagination: buildPageRange', () => {
  it('retorna todas as páginas quando total <= 7', () => {
    expect(buildPageRange(1, 1)).toEqual([1]);
    expect(buildPageRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('insere reticências corretamente no início, meio e fim de catálogos grandes', () => {
    expect(buildPageRange(1, 20)).toEqual([1, 2, 3, 4, 'ellipsis', 20]);
    expect(buildPageRange(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
    expect(buildPageRange(19, 20)).toEqual([1, 'ellipsis', 17, 18, 19, 20]);
  });
});
