# Landing page · Boné Stay Alive (Lipe Alive)

Next.js 14 (App Router) + TypeScript + Tailwind + framer-motion. Mobile-first.

## Rodar

```bash
npm install
npm run dev
```

## Configuração

Tudo que muda fica em `src/lib/config.ts` (nome, preço, parcelado, texto do botão, mídias, `hero.mode`).

`hero.mode` é `"3d"` por padrão e carrega `public/media/bone/bone.glb`. Sem o arquivo, o hero mostra a imagem estática.
`"video"` volta para o `<video>` 360°.

### Boné 3D (bone.glb)

O boné é gerado por script, não em runtime:

```bash
npx tsx scripts/export-cap.ts   # → public/media/bone/bone.glb (~600 kB)
```

O script monta o 5 panel procedural em three.js, gera as texturas com sharp (ripstop em normal map, bordado
"Stay Alive." com relevo em Inter Tight, aba com pesponto) em WebP, e grava o glTF quantizado + meshopt.
Para trocar o modelo por um GLB real, basta substituir o arquivo (nós nomeados `crown`, `brim`, `decal`...;
o `decal` recebe polygonOffset/transparência no load).

No site: `CapModel` carrega o GLB (GLTFLoader + meshopt), pré-compila um material por frame com `gl.compile`
e só então libera a entrada do boné. Os auxiliares da cena (ambiente, pós-processamento, partículas, sombra)
montam um por frame para espalhar a compilação de shaders.

Hero 3D: `src/components/hero3d/Scene.tsx` (luzes, câmera, scroll story, callouts). O roteiro do scroll
(rotação, zoom, saída) são os keyframes no topo desse arquivo; os textos e âncoras dos callouts ficam em `src/lib/heroStore.ts`.

Variáveis em `.env.local`:

```
NEXT_PUBLIC_CHECKOUT_URL=#      # "#" = botão visível, sem navegar
NEXT_PUBLIC_META_PIXEL_ID=      # vazio = Pixel desligado
```

## Mídias

| Pasta | Arquivo | Formato |
|---|---|---|
| `public/media/bone/` | `bone-360.webm` | vídeo 360° em loop, 3:4 ou 1:1, VP9, sem áudio |
| `public/media/bone/` | `bone-360.mp4` | mesmo vídeo em H.264 (fallback Safari/iOS) |
| `public/media/bone/` | `bone-poster.jpg` | primeiro frame do 360°, mesma proporção |
| `public/media/bone/` | `bone.glb` | modelo 3D (só para `hero.mode = "3d"`) |
| `public/media/video/` | `lipe.mp4` | vídeo vertical 9:16 do Lipe, H.264 + AAC |
| `public/media/video/` | `lipe-poster.jpg` | poster 9:16 do vídeo |

Enquanto os arquivos não existirem, a página usa os recortes do storyboard em `public/media/img/`.

## Vídeo da dobra 2

Sem `lipe.mp4`: card com a imagem do bordado e "Vídeo em breve". Com o arquivo: ao entrar ~60% na tela,
contagem 3-2-1 e o vídeo começa mudo (botão "Ativar som"). Ao terminar, volta para a imagem com "Repetir vídeo"
(repete com som). Sai da tela: pausa; volta: continua.

## Seção "Sobre o Lipe"

Dados em `config.lipe` (mesmos textos, links e foto da LP Alive Finance). Imagens em `public/media/img/lipe/`.

## Tracking (Meta Pixel)

- `PageView` e `ViewContent` (value = preço) no carregamento.
- `CliqueCheckout` com `posicao` = `hero` | `dobra2` | `sticky` (barra fixa do mobile).
- `VSL` com `pct` = 25 | 50 | 75 | 95 no vídeo do Lipe, e `VideoRepetir` no botão de repetir.
- O botão repassa `utm_*`, `fbclid` e `src` da URL da página para o checkout.
