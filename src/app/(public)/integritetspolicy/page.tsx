const sections = [
  "Personuppgiftsansvarig",
  "Vilka uppgifter vi behandlar",
  "Ändamål och rättslig grund",
  "Lagringstid",
  "Dina rättigheter",
  "Cookies",
  "Användarvillkor",
  "Kontakt",
];

export const metadata = { title: "Integritetspolicy & villkor" };

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
        Integritetspolicy & villkor
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-text-muted">
        Den här sidan är en platshållare. Det juridiska innehållet skrivs i en
        senare fas – rubrikerna nedan visar vilken struktur sidan är tänkt att
        få.
      </p>

      <div className="mt-12 space-y-8">
        {sections.map((section) => (
          <section key={section}>
            <h2 className="text-base font-semibold text-text">{section}</h2>
            <p className="mt-1.5 text-sm text-text-subtle">Innehåll kommer.</p>
          </section>
        ))}
      </div>
    </div>
  );
}
