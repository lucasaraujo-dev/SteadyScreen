# SteadyScreen

Compartilhamento de tela de código aberto, direto do navegador.

> **Fase 1 (atual):** quem compartilha usa só o navegador (`getDisplayMedia`) e o vídeo vai direto,
> por WebRTC, para até 5 pessoas assistindo (P2P). O servidor só apresenta os navegadores um ao outro.

## Como funciona

```
Quem compartilha (navegador)            Servidor Go (server/)             Quem assiste (navegador)
  getDisplayMedia ─┐                 ┌─ salas e links (API REST)
                   └── sinalização ──┤                                ┌── sinalização
                       (WebSocket)   └─ repassa offer/answer/ICE ─────┘
  RTCPeerConnection ════════════ vídeo e áudio direto (WebRTC P2P) ════════ <video>
```

| Pasta | O que é |
|---|---|
| `web/` | Site em Next.js + TypeScript: página inicial, `/compartilhar/[id]` e `/sala/[id]` |
| `server/` | API em Go: cria salas, gera links e faz a sinalização WebRTC |

A parte de transmissão fica isolada em `web/src/lib/host.ts` e `web/src/lib/viewer.ts`. Na próxima fase,
ela é trocada por um servidor em Go que distribui o vídeo (SFU), e aí o limite de 5 pessoas deixa de existir.

## Rodando no seu PC

Pré-requisitos: [Node.js](https://nodejs.org) 20+ e [Go](https://go.dev/dl) 1.23+.

**1. Servidor** (em um terminal):

```bash
cd server
go mod tidy
go run .
```

**2. Site** (em outro terminal):

```bash
cd web
npm install
npm run dev
```

Abra http://localhost:3000, clique em **Compartilhar minha tela** e abra o link da sala em outra aba.

### Assistir de outro computador da mesma rede

Na página de compartilhar, troque `localhost` pelo IP do seu PC (ex.: `http://192.168.0.10:3000/sala/abc123`).
Quem compartilha precisa estar em `localhost` ou em HTTPS, porque o navegador só permite capturar a tela
nesses casos. Quem assiste pode usar o IP normalmente. Se o Windows perguntar, libere as portas 3000 e 8080 no firewall.

## Configuração do servidor

| Variável | Padrão | Para que serve |
|---|---|---|
| `ADDR` | `:8080` | Endereço e porta |
| `MAX_VIEWERS` | `5` | Espectadores por sala |
| `ALLOWED_ORIGINS` | *(vazio = qualquer)* | Sites que podem usar a API, separados por vírgula. Defina em produção. |
| `STUN_URLS` | `stun:stun.l.google.com:19302` | Servidores STUN |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | *(vazio)* | Servidor TURN (coturn), necessário na VPS |

No site, `NEXT_PUBLIC_SERVER_URL` aponta para o servidor (padrão: mesmo host, porta 8080).

## Roteiro

- [x] **Fase 1:** compartilhar pelo navegador, P2P, até 5 espectadores, localhost
- [ ] Subir na VPS: domínio, HTTPS, TURN (coturn)
- [ ] **Fase 2:** SFU em Go (Pion), sem limite de 5; Sunshine + NVENC/AMF no PC de quem compartilha; fallback com WebCodecs
- [ ] **Fase 3:** app nativo com motor de captura próprio, controle remoto de mouse e teclado, instalador assinado

## Licença

[GPL-3.0](LICENSE).
