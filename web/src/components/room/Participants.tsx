import { CameraIcon, ScreenIcon } from "@/components/icons";
import { initials, type Participant } from "@/lib/room";

type Props = {
  participants: Participant[];
  selfId: string | null;
  maxViewers: number;
  /** Host only: viewers whose video is connected, to show "assistindo". */
  watchingIds?: string[];
  hostSharing?: boolean;
};

/**
 * Participants as a "dynamic island": a slim black pill of avatars that
 * springs open on hover (or keyboard focus) to show names and status.
 */
export default function Participants({
  participants,
  selfId,
  maxViewers,
  watchingIds,
  hostSharing,
}: Props) {
  const viewers = participants.filter((p) => p.role === "viewer").length;
  return (
    <aside className="people-rail" aria-label="Participantes">
      <div className="island" tabIndex={0}>
        <header className="island-head">
          <span className="island-title">Participantes</span>
          <span className="island-count">
            {viewers}/{maxViewers}
          </span>
        </header>

        <ul className="island-list">
          {participants.map((p) => {
            const isSelf = p.id === selfId;
            let status: React.ReactNode = null;
            let dot = "";
            if (p.role === "host" && p.sharing) {
              dot = "is-live";
              status = (
                <span className="person-status is-live">
                  {p.sharing === "camera" ? (
                    <CameraIcon size={13} />
                  ) : (
                    <ScreenIcon size={13} />
                  )}
                  {p.sharing === "camera" ? "Câmera" : "Tela"}
                </span>
              );
            } else if (p.role === "viewer" && watchingIds && hostSharing) {
              const watching = watchingIds.includes(p.id);
              dot = watching ? "is-watching" : "";
              status = (
                <span className="person-status">
                  {watching ? "Assistindo" : "Conectando…"}
                </span>
              );
            }
            return (
              <li key={p.id} className="person" title={p.name}>
                <span
                  className={`avatar${p.role === "host" ? " is-host" : ""}${isSelf ? " is-self" : ""}${p.avatar ? " has-photo" : ""}`}
                  aria-hidden
                >
                  {p.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny photo from our own API
                    <img
                      className="avatar-photo"
                      src={p.avatar}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    initials(p.name)
                  )}
                  {dot && <span className={`avatar-dot ${dot}`} />}
                </span>
                <span className="person-main">
                  <span className="person-name">
                    {p.name}
                    {isSelf && <span className="person-you"> (você)</span>}
                  </span>
                  <span className="person-role">
                    {p.role === "host" ? "Anfitrião" : "Convidado"}
                  </span>
                </span>
                {status}
              </li>
            );
          })}
          {participants.length === 0 && (
            <li className="person" aria-label="Conectando">
              <span className="avatar is-loading" aria-hidden />
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
