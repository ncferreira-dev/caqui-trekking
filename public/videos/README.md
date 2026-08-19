# `public/videos/` — o vídeo do herói

Quatro arquivos de vídeo e dois pôsteres, todos derivados de **um master** que
**não vive neste repositório**.

| Arquivo                             | O que é                   |   Peso |
| ----------------------------------- | ------------------------- | -----: |
| `hero-trekking.webm`                | desktop, VP9, 1920×1080   | 2,2 MB |
| `hero-trekking.mp4`                 | desktop, H.264 (fallback) | 3,2 MB |
| `hero-trekking-vertical.webm`       | celular, VP9, 720×1162    | 1,0 MB |
| `hero-trekking-vertical.mp4`        | celular, H.264 (fallback) | 1,5 MB |
| `hero-trekking-poster.jpg`          | 1º quadro do desktop      |  45 KB |
| `hero-trekking-poster-vertical.jpg` | 1º quadro do celular      |  81 KB |

Quem escolhe qual deles toca é `src/lib/media/video-heroi.ts` — lógica pura,
coberta por `src/test/video-heroi.test.ts`. **Trocar nome de arquivo aqui exige
mexer lá**, e o teste quebra se as duas orientações apontarem para o mesmo
caminho.

---

## As quatro decisões que não são óbvias

**1. Sem faixa de áudio.** Não é só `muted` no HTML: o áudio foi removido do
arquivo (`-an`). `muted` é o que permite o autoplay no iOS; a ausência da faixa
é o que garante que nunca haverá som mesmo se alguém apagar o atributo. E
economiza bytes.

**2. 12,84s, não 13,44s — o fim se dissolve na abertura.** O master sobe de
drone: começa no grupo no cume e termina na vista aberta da serra. Em `loop`,
voltar da vista para o grupo dava um corte seco. Os últimos 0,6s recebem a
abertura em fade, então o loop fecha sozinho. O começo continua puro — quem
chega vê o grupo, não um dissolve.

**3. O pôster é o QUADRO ZERO.** Não é a frame mais bonita do vídeo (essa é a
vista, no fim). Se o pôster fosse a vista, haveria um salto visível no instante
em que o vídeo começa a tocar. Pôster e primeiro quadro têm que ser a mesma
imagem.

**4. O recorte do desktop é a faixa ALTA do master vertical (`y=300`).** Não é
o centro. Testado: no centro o grupo aparece decapitado na abertura, e embaixo
o final vira rocha escura. Na faixa alta a abertura preserva céu e cabeças, e o
fim entrega a vista completa.

---

## Trocar o vídeo

O master **não fica no git** (80 MB). Guarde onde quiser fora de
`caqui-trekking/` e rode a receita abaixo a partir dele.

```bash
F="seu-master.mov"; OUT=public/videos
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F"); FD=0.6
BODY=$(python3 -c "print(f'{$D-$FD:.2f}')"); HEAD=$(python3 -c "print(f'{$D-2*$FD:.2f}')")

filtro() {
  printf '[0:v]%s,fps=25,format=yuv420p[src];[src]split[b][h];[b]trim=0:%s,setpts=PTS-STARTPTS[body];[h]trim=0:%s,setpts=PTS-STARTPTS+%s/TB,format=yuva420p,fade=t=in:st=%s:d=%s:alpha=1[head];[body][head]overlay=format=auto,format=yuv420p[out]' \
    "$1" "${BODY}" "${FD}" "${HEAD}" "${HEAD}" "${FD}"
}
```

O enquadramento depende da orientação do master:

```bash
# master VERTICAL (o caso atual: 2160×3488)
DESK='crop=2160:1215:0:300,scale=1920:1080'   # faixa alta → 16:9
MOB='scale=720:-2'                             # nativo, sem corte

# master HORIZONTAL (3840×2160)
DESK='scale=1920:1080'                         # nativo, sem corte
MOB='crop=1215:2160:1312:0,scale=720:-2'       # faixa central → vertical
```

E a codificação, em dois passes para bater a meta de peso:

```bash
enc_vp9() {  # $1 filtro  $2 bitrate  $3 saída
  ffmpeg -v error -i "$F" -filter_complex "$(filtro "$1")" -map '[out]' -an \
    -c:v libvpx-vp9 -b:v "$2" -pass 1 -passlogfile /tmp/vp9 -row-mt 1 -cpu-used 4 -deadline good -g 50 -f null /dev/null -y
  ffmpeg -v error -i "$F" -filter_complex "$(filtro "$1")" -map '[out]' -an \
    -c:v libvpx-vp9 -b:v "$2" -pass 2 -passlogfile /tmp/vp9 -row-mt 1 -cpu-used 1 -deadline good -g 50 -auto-alt-ref 1 -lag-in-frames 25 "$3" -y
}
enc_h264() {
  ffmpeg -v error -i "$F" -filter_complex "$(filtro "$1")" -map '[out]' -an \
    -c:v libx264 -b:v "$2" -pass 1 -passlogfile /tmp/x264 -preset medium -profile:v high -g 50 -f null /dev/null -y
  ffmpeg -v error -i "$F" -filter_complex "$(filtro "$1")" -map '[out]' -an \
    -c:v libx264 -b:v "$2" -pass 2 -passlogfile /tmp/x264 -preset slow -profile:v high -level 4.0 -g 50 -movflags +faststart "$3" -y
}

enc_vp9  "$DESK" 1400k "$OUT/hero-trekking.webm"
enc_h264 "$DESK" 2000k "$OUT/hero-trekking.mp4"
enc_vp9  "$MOB"   650k "$OUT/hero-trekking-vertical.webm"
enc_h264 "$MOB"   950k "$OUT/hero-trekking-vertical.mp4"

# Pôsteres — quadro ZERO, mesmo enquadramento de cada vídeo.
ffmpeg -v error -i "$F" -frames:v 1 -vf "$DESK" -q:v 6 "$OUT/hero-trekking-poster.jpg" -y
ffmpeg -v error -i "$F" -frames:v 1 -vf "$MOB"  -q:v 6 "$OUT/hero-trekking-poster-vertical.jpg" -y
```

> ⚠️ **`zsh` come `:a` e `:d` como modificadores de parâmetro.** As chaves em
> `${FD}` e `${HEAD}` não são estilo: sem elas, `d=$FD:alpha=1` vira um caminho
> absoluto e o ffmpeg recusa o filtro com uma mensagem que não explica nada.

---

## Gravar um master novo

**Formato:** horizontal **e** vertical, se der — a mesma cena nas duas
orientações rende enquadramento de verdade nos dois lados, em vez de recorte.
1080p ou 4K, **30fps** (não 60: dobra o peso sem ganho aqui), 10–15s em tomada
única.

**Composição:** tudo o que precisa aparecer no terço central. O que fica na
borda não existe no corte da outra orientação.

**Funciona:** cachoeira, neblina subindo, nuvem na crista, câmera parada com
movimento no quadro, tilt lento numa face de rocha, trilha subindo na diagonal.

**Não funciona:** panorâmica lateral rápida (comprime mal e vira borrão),
interesse espalhado na horizontal, rosto identificável em primeiro plano sem
autorização, timestamp ou marca d'água queimada.

> ⚠️ Um arquivo 16:9 gerado a partir do vertical **com borrão nas laterais** (o
> preenchimento de rede social) não serve como master horizontal. Ele tem menos
> resolução útil que o vertical original e já vem recodificado. Foi tentado em
> 18/08/2026 e descartado.
