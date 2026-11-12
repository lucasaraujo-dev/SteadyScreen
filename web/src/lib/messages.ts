/** User-facing text for error codes coming from the server or the browser. */
export function errorText(reason: string): string {
  switch (reason) {
    case "room-not-found":
      return "Essa sala não existe ou já expirou.";
    case "room-full":
      return "A sala está cheia. Nesta versão cabem até 5 pessoas assistindo.";
    case "bad-token":
      return "Esta aba não tem permissão para compartilhar nesta sala.";
    case "replaced":
      return "A transmissão foi aberta em outra aba. Esta aba foi desconectada.";
    case "room-closed":
      return "A sala foi encerrada.";
    case "disconnected":
      return "A conexão com o servidor caiu. Recarregue a página para tentar de novo.";
    case "server-offline":
      return "Não foi possível falar com o servidor do SteadyScreen. Ele está rodando?";
    case "negotiation-failed":
      return "Não foi possível conectar com quem está compartilhando.";
    case "camera-denied":
      return "Não foi possível usar a câmera. Permita o acesso à câmera no navegador e tente de novo.";
    case "camera-missing":
      return "Nenhuma câmera foi encontrada neste computador.";
    case "mic-denied":
      return "Não foi possível usar o microfone. Permita o acesso ao microfone no navegador e tente de novo.";
    case "unsupported":
      return "Este navegador não permite compartilhar a tela. Use Chrome, Edge ou Firefox no computador.";
    default:
      return "Algo deu errado. Recarregue a página para tentar de novo.";
  }
}
