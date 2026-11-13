/** User-facing text for error codes coming from the server or the browser. */
export function errorText(reason: string): string {
  switch (reason) {
    // accounts
    case "bad-credentials":
      return "E-mail ou senha incorretos.";
    case "email-taken":
      return "Já existe uma conta com esse e-mail. Tente entrar.";
    case "bad-email":
      return "Esse e-mail não parece certo. Confira e tente de novo.";
    case "name-required":
      return "Diga seu nome para criar a conta.";
    case "weak-password":
      return "A senha precisa ter pelo menos 8 caracteres.";
    case "long-password":
      return "A senha pode ter no máximo 72 caracteres.";
    case "too-many-attempts":
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    case "not-logged-in":
      return "Sua sessão terminou. Entre de novo para criar uma sala.";
    // account settings
    case "wrong-password":
      return "A senha atual está errada.";
    case "email-already-confirmed":
      return "Esse e-mail já está confirmado.";
    case "email-not-configured":
      return "O envio de e-mails ainda não foi ligado no servidor.";
    case "email-send-failed":
      return "Não conseguimos enviar o e-mail agora. Tente de novo daqui a pouco.";
    case "too-many-codes":
      return "Você já pediu vários códigos. Espere uns minutos e tente de novo.";
    case "wrong-code":
      return "Código errado. Confira o e-mail e tente de novo.";
    case "code-expired":
      return "Esse código venceu. Peça um novo.";
    case "link-expired":
      return "Esse QR code venceu. Gere um novo no computador.";
    case "link-used":
      return "Esse QR code já foi lido por outro celular. Gere um novo no computador.";
    case "link-denied":
      return "O computador recusou a entrada deste celular.";
    case "link-not-scanned":
      return "Nenhum celular leu o QR code ainda.";
    case "avatar-too-big":
      return "Essa imagem é grande demais. Tente outra.";
    case "bad-image":
      return "Esse arquivo não é uma imagem que dá para usar. Use JPG, PNG ou WebP.";
    // rooms
    case "room-not-found":
      return "Essa sala não existe ou foi excluída.";
    case "room-full":
      return "A sala está cheia. Nesta versão cabem até 5 pessoas assistindo.";
    case "bad-token":
      return "Só quem criou esta sala pode compartilhar nela. Entre com a conta dona da sala.";
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
