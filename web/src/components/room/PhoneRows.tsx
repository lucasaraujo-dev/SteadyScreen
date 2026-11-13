import { PhoneIcon } from "@/components/icons";
import type { Phone } from "@/lib/phoneBridge";

/**
 * "Usar o celular como câmera / microfone": one row per linked phone that has
 * the SteadyScreen page open. Picking one sends the request to the phone.
 */
export default function PhoneRows({
  what,
  phones,
  phoneId,
  onPick,
  onStop,
}: {
  what: "câmera" | "microfone";
  phones: Phone[];
  /** The phone in use right now. */
  phoneId?: string;
  onPick: (phone: Phone) => void;
  /** Go back to this computer's device. */
  onStop?: () => void;
}) {
  if (phones.length === 0) {
    return (
      <div className="menu-row is-soon phone-row-empty">
        <span>
          Usar o celular como {what}
          <small>
            Vincule um celular nas configurações da conta e deixe o SteadyScreen
            aberto nele.
          </small>
        </span>
      </div>
    );
  }
  return (
    <div className="phone-rows">
      {phones.map((p) => {
        const using = p.id === phoneId;
        return (
          <button
            key={p.id}
            type="button"
            className={`menu-row phone-row${using ? " is-using" : ""}`}
            onClick={() => (using ? onStop?.() : onPick(p))}
          >
            <span className="phone-row-name">
              <PhoneIcon size={16} />
              {using
                ? `${what[0].toUpperCase()}${what.slice(1)} do ${p.name}`
                : `Usar ${p.name}`}
            </span>
            <span className={`soon-pill${using ? " is-live" : ""}`}>
              {using ? (onStop ? "Parar" : "Em uso") : "Pedir"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
