// Hero estilo "cardápio digital": mosaico de fotos no topo com cantos curvos,
// logo circular sobreposta, nome da loja, cidade · "mais informações", e
// status "Aberto até HH:mm" baseado em business_hours.

import { useMemo } from "react";
import { MapPin, Cake, ChevronRight } from "lucide-react";
import { EditableText, EditableImage } from "@/components/InlineEdit";
import { getOpenStatus, DAY_SHORT, type BusinessHours } from "@/lib/business-hours";

type Props = {
  shopName: string;
  shopLogo: string | null;
  heroTitle: string;
  heroSubtitle: string;
  heroImages: string[]; // até 4
  bannerUrl: string | null; // fallback
  city: string | null;
  state: string | null;
  businessHours: BusinessHours | null;
  editing: boolean;
  onTitle: (v: string) => void;
  onSubtitle: (v: string) => void;
  onMoreInfoClick: () => void;
  onUploadHero: (slot: number, file: File) => void;
  onRemoveHero?: (slot: number) => void;
};

export function HeroCardapio({
  shopName, shopLogo, heroTitle, heroSubtitle, heroImages, bannerUrl,
  city, state, businessHours, editing,
  onTitle, onSubtitle, onMoreInfoClick, onUploadHero,
}: Props) {
  // Sempre 4 slots para edição; em visualização mostramos só os preenchidos.
  const slots = useMemo(() => {
    const arr = [...heroImages];
    while (arr.length < 4) arr.push("");
    return arr.slice(0, 4);
  }, [heroImages]);

  const visibleImages = heroImages.filter(Boolean);
  const useBannerFallback = !editing && visibleImages.length === 0 && bannerUrl;

  const status = getOpenStatus(businessHours ?? null);

  return (
    <header className="relative pb-14">
      {/* Mosaico de fotos */}
      <div className="relative overflow-hidden rounded-b-[2rem]">
        {useBannerFallback ? (
          <img src={bannerUrl!} alt="" className="h-44 w-full object-cover sm:h-56" loading="eager" />
        ) : editing ? (
          <div className="grid h-44 grid-cols-4 gap-1 sm:h-56">
            {slots.map((src, i) => (
              <EditableImage
                key={i}
                editing={editing}
                src={src || null}
                alt=""
                aspect="h-full w-full"
                onUpload={(f) => onUploadHero(i, f)}
                fallback={
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-blush via-cream to-rose/30 text-mauve/40 text-xs">
                    Foto {i + 1}
                  </div>
                }
              />
            ))}
          </div>
        ) : visibleImages.length > 0 ? (
          <div className={`grid h-44 gap-1 sm:h-56 ${visibleImages.length === 1 ? "grid-cols-1" : visibleImages.length === 2 ? "grid-cols-2" : visibleImages.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
            {visibleImages.map((src, i) => (
              <img key={i} src={src} alt="" className="h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
            ))}
          </div>
        ) : (
          <div className="grid h-44 w-full place-items-center bg-gradient-to-br from-blush via-cream to-rose/40 sm:h-56">
            <Cake className="h-12 w-12 text-mauve/30" strokeWidth={1.2} />
          </div>
        )}
      </div>

      {/* Logo circular sobreposta */}
      <div className="relative z-10 -mt-12 flex justify-center">
        {shopLogo ? (
          <img
            src={shopLogo}
            alt={shopName}
            className="h-24 w-24 rounded-full border-4 border-cream bg-white object-cover shadow-lg"
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-cream bg-rose shadow-lg">
            <Cake className="h-9 w-9 text-mauve" strokeWidth={1.3} />
          </div>
        )}
      </div>

      {/* Card de informações da loja */}
      <div className="mx-auto mt-3 max-w-md rounded-3xl bg-white px-5 py-4 text-center shadow-sm">
        <EditableText
          editing={editing}
          value={heroTitle}
          onChange={onTitle}
          as="h1"
          className="font-brand text-xl font-bold text-mauve sm:text-2xl"
          placeholder={shopName}
        />
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-mauve/70">
          {(city || state) && (
            <>
              <MapPin className="h-3.5 w-3.5 text-mauve/50" />
              <span>{[city, state].filter(Boolean).join(" - ")}</span>
              <span className="text-mauve/30">•</span>
            </>
          )}
          <button
            onClick={onMoreInfoClick}
            className="text-mauve/80 underline-offset-2 hover:underline"
          >
            Mais informações
          </button>
        </div>
        <p
          className={`mt-2 text-sm font-semibold ${status.open ? "text-emerald-600" : "text-mauve/60"}`}
        >
          {status.open
            ? `Aberto até às ${status.closesAt}`
            : status.opensAt
            ? `Fechado · abre ${status.opensDay ? DAY_SHORT[status.opensDay] : ""} ${status.opensAt}`
            : "Horário não informado"}
        </p>
        {(editing || heroSubtitle) && (
          <EditableText
            editing={editing}
            value={heroSubtitle}
            onChange={onSubtitle}
            as="p"
            className="mt-2 text-xs italic text-mauve/70"
            placeholder="Frase opcional sobre sua loja"
          />
        )}
      </div>
    </header>
  );
}

export function PickupDeliveryCard({
  pickupEnabled, deliveryEnabled,
  pickupAddress, deliveryAddress,
  onClick,
}: {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  onClick: () => void;
}) {
  if (!pickupEnabled && !deliveryEnabled) return null;
  const primary = pickupEnabled ? "Retirar no local" : "Entrega";
  const address = pickupEnabled ? pickupAddress : deliveryAddress;
  return (
    <button
      onClick={onClick}
      className="mx-auto mt-3 flex w-full max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm transition hover:shadow"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush/60 text-mauve">
        🚶
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-mauve">{primary}</p>
        {address && <p className="truncate text-xs text-mauve/60">{address}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-mauve/40" />
    </button>
  );
}
