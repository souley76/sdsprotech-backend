"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function Page({ params }: { params: { page: string } }) {
  const page = params.page;

  switch (page) {
    case "accessoires":
      return <AccessoiresPage />;
    case "ordinateurs":
      return <OrdinateursPage />;
    case "produit":
      return <ProduitPage />;
    case "credit-halal":
      return <CreditHalalPage />;
    case "mon-credit":
      return <MonCreditPage />;
    case "salle-visionnage":
      return <SalleVisionnagePage />;
    case "vitrine-boutique":
      return <VitrineBoutiquePage />;
    case "portail":
      return <PortailPage />;
    default:
      return <UnknownPage />;
  }
}

function UnknownPage() {
  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-10 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <h1 className="text-4xl font-black text-white">Page introuvable</h1>
          <p className="mt-4 text-slate-300">
            La page demandée n'existe pas encore dans votre application React. Retournez à l'accueil pour choisir une section disponible.
          </p>
          <Link href="/" className="mt-8 inline-flex rounded-3xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </main>
  );
}

function AccessoiresPage() {
  const navLinks = [
    { href: "/", label: "Smartphones" },
    { href: "/accessoires", label: "🎧 Accessoires", active: true },
    { href: "/ordinateurs", label: "💻 Ordinateurs" },
  ];

  const categories = [
    "Tout",
    "Coques",
    "Écouteurs",
    "Chargeurs",
    "Câbles",
    "Powerbanks",
    "Autre",
  ];

  const products = [
    {
      id: "coque-1",
      category: "Coques",
      name: "Coque renforcée Galaxy",
      description: "Protection premium anti-choc pour Galaxy et iPhone.",
      price: "8 500",
      icon: "🛡️",
    },
    {
      id: "ecouteurs-1",
      category: "Écouteurs",
      name: "Écouteurs True Wireless",
      description: "Son clair et basses puissantes pour vos appels et musique.",
      price: "14 900",
      icon: "🎧",
    },
    {
      id: "chargeur-1",
      category: "Chargeurs",
      name: "Chargeur rapide 65W",
      description: "Recharge ultra-rapide compatible smartphone et tablette.",
      price: "12 500",
      icon: "⚡",
    },
    {
      id: "cable-1",
      category: "Câbles",
      name: "Câble USB-C tressé",
      description: "Câble solide, rapide et résistant à l'usure.",
      price: "3 200",
      icon: "🔌",
    },
    {
      id: "powerbank-1",
      category: "Powerbanks",
      name: "Powerbank 20 000 mAh",
      description: "Autonomie longue durée pour votre smartphone en déplacement.",
      price: "22 000",
      icon: "🔋",
    },
    {
      id: "autre-1",
      category: "Autre",
      name: "Kit nettoyage premium",
      description: "Microfibre et spray pour écran propre et net.",
      price: "4 200",
      icon: "✨",
    },
  ];

  const advantages = [
    { icon: "🚚", title: "Livraison Gratuite", description: "Livraison offerte dans tout Dakar." },
    { icon: "✅", title: "Qualité Garantie", description: "Accessoires testés et certifiés SDS PRO." },
    { icon: "💳", title: "Paiement Mobile", description: "Wave, Mixx, Djamo, MaxIt acceptés." },
    { icon: "💬", title: "Support 7j/7", description: "Assistance rapide sur WhatsApp." },
  ];

  const [selectedCategory, setSelectedCategory] = useState("Tout");

  const filteredProducts = useMemo(
    () =>
      selectedCategory === "Tout"
        ? products
        : products.filter((product) => product.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020912]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-white">
            <img src="/logo-sds.svg" alt="SDS PRO" className="h-10 w-auto" />
            <span className="hidden md:inline">SDS PRO</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition ${link.active ? "text-cyan-300" : "hover:text-cyan-300"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://wa.me/221770699739"
            target="_blank"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            💬 WhatsApp
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 py-20 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,229,255,0.12),_transparent_50%)] opacity-60" />
        <div className="relative mx-auto max-w-[1400px] rounded-[32px] border border-white/10 bg-[#04101d]/95 p-10 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:p-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_0.7fr] lg:items-center">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                Accessoires Premium
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Équipez <span className="block text-cyan-400">votre mobile</span> avec style
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300">
                Coques, écouteurs, chargeurs, câbles et powerbanks. Tout ce qu'il vous faut pour
                votre smartphone, livré rapidement à Dakar.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#catalogue" className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Voir les accessoires
                </a>
                <Link href="https://wa.me/221770699739" target="_blank" className="rounded-2xl border border-cyan-500 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-white/5">
                  Contacter WhatsApp
                </Link>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Sélection rapide</div>
              <p className="mt-6 text-3xl font-black text-white">{filteredProducts.length}</p>
              <p className="mt-2 text-sm text-slate-400">accessoires disponibles</p>
              <div className="mt-8 grid gap-3 text-left text-sm text-slate-300">
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Livraison</div>
                  <div className="mt-1 text-sm text-slate-400">Gratuite dans tout Dakar</div>
                </div>
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Paiement</div>
                  <div className="mt-1 text-sm text-slate-400">Wave, Mixx, Djamo, MaxIt</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalogue" className="px-6 pb-24 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">// Catalogue</p>
            <h2 className="text-4xl font-black text-white sm:text-5xl">Nos accessoires</h2>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? "border-cyan-400 bg-cyan-500 text-black"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400 hover:bg-white/10"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-[32px] border border-white/10 bg-[#04101d]/90 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-cyan-400/30">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800 text-4xl shadow-lg shadow-cyan-500/10">
                  {product.icon}
                </div>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-300">
                      {product.category}
                    </span>
                    <span className="text-right font-black text-cyan-300">{product.price} FCFA</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{product.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{product.description}</p>
                  </div>
                </div>
                <button className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Ajouter au panier
                </button>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="mt-8 rounded-[32px] border border-white/10 bg-[#03101d]/90 p-12 text-center text-slate-400">
              Aucun accessoire trouvé pour cette catégorie.
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-[1400px] space-y-10">
          <div className="space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">// Avantages</p>
            <h2 className="text-4xl font-black text-white sm:text-5xl">Pourquoi acheter chez nous</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {advantages.map((item) => (
              <div key={item.title} className="rounded-[28px] border border-white/10 bg-[#04101d]/90 p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,0.25)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-3xl text-cyan-300">
                  {item.icon}
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-16 text-slate-300 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/logo-sds.svg" alt="SDS PRO" className="h-12 w-auto" />
              <span className="text-lg font-semibold text-white">SDS PRO</span>
            </div>
            <p className="max-w-xl leading-7 text-slate-400">
              Votre boutique d'accessoires smartphones premium à Dakar. Coques, chargeurs, écouteurs et powerbanks de qualité.
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">NINEA : 013038395 | RCCM : SN DKR 2026 A 16899</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Catalogue</h3>
            <div className="space-y-3 text-sm">
              <Link href="/" className="block transition hover:text-cyan-300">Smartphones</Link>
              <Link href="/accessoires" className="block transition hover:text-cyan-300">Accessoires</Link>
              <Link href="/ordinateurs" className="block transition hover:text-cyan-300">Ordinateurs</Link>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Contact</h3>
            <div className="space-y-3 text-sm">
              <a href="tel:+221770699739" className="block transition hover:text-cyan-300">77 069 97 39</a>
              <a href="https://wa.me/221770699739" className="block transition hover:text-cyan-300">WhatsApp</a>
              <a href="https://www.facebook.com/share/1LQKP4saFs/" className="block transition hover:text-cyan-300">Facebook</a>
              <a href="https://www.instagram.com/seckdigitalservicepro1" className="block transition hover:text-cyan-300">Instagram</a>
              <a href="mailto:contact@sdsprotech.com" className="block transition hover:text-cyan-300">Email</a>
              <a href="#" className="block transition hover:text-cyan-300">Petit Mbao, Dakar</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function OrdinateursPage() {
  const navLinks = [
    { href: "/", label: "Smartphones" },
    { href: "/accessoires", label: "🎧 Accessoires" },
    { href: "/ordinateurs", label: "💻 Ordinateurs", active: true },
  ];

  const categories = [
    "Tout",
    "MacBook",
    "Windows / PC",
    "Gaming",
    "Bureautique",
    "Étudiant",
    "Accessoires PC",
    "Autre",
  ];

  const products = [
    {
      id: "macbook-air",
      category: "MacBook",
      name: "MacBook Air M2",
      description: "Ultra-fin, performant et conçu pour la mobilité à Dakar.",
      price: "249 900",
      icon: "🍎",
    },
    {
      id: "macbook-pro",
      category: "MacBook",
      name: "MacBook Pro 14",
      description: "Puissance Pro pour création, montage vidéo et graphisme.",
      price: "399 900",
      icon: "💻",
    },
    {
      id: "dell-xps",
      category: "Windows / PC",
      name: "Dell XPS 13",
      description: "Design premium, écran InfinityEdge et autonomie longue durée.",
      price: "219 900",
      icon: "🖥️",
    },
    {
      id: "hp-envy",
      category: "Windows / PC",
      name: "HP Envy 16",
      description: "Puissance bureau portable, idéal pour productivité et multitâche.",
      price: "199 900",
      icon: "⚙️",
    },
    {
      id: "rog-zephyrus",
      category: "Gaming",
      name: "Asus ROG Zephyrus",
      description: "Performance gaming ultra-rapide avec refroidissement avancé.",
      price: "329 900",
      icon: "🎮",
    },
    {
      id: "lenovo-yoga",
      category: "Bureautique",
      name: "Lenovo Yoga 9i",
      description: "Convertible 2-en-1 pour travail et divertissement.",
      price: "189 900",
      icon: "🧠",
    },
    {
      id: "acer-nitro",
      category: "Gaming",
      name: "Acer Nitro 16",
      description: "Gaming accessible avec écran rapide et son puissant.",
      price: "169 900",
      icon: "🔥",
    },
    {
      id: "student-laptop",
      category: "Étudiant",
      name: "Laptop étudiant 14",
      description: "Léger, fiable et parfait pour études et réunions en ligne.",
      price: "119 900",
      icon: "🎓",
    },
    {
      id: "pc-accessory",
      category: "Accessoires PC",
      name: "Souris gaming RGB",
      description: "Confort optimal, haute précision pour productivité et jeux.",
      price: "9 500",
      icon: "🖱️",
    },
  ];

  const advantages = [
    { icon: "🚚", title: "Livraison Gratuite", description: "Livraison offerte dans tout Dakar." },
    { icon: "✅", title: "Qualité Garantie", description: "Matériel vérifié et certifié SDS PRO." },
    { icon: "💳", title: "Paiement Mobile", description: "Wave, Mixx, Djamo et MaxIt acceptés." },
    { icon: "💬", title: "Support 7j/7", description: "Assistance rapide sur WhatsApp." },
  ];

  const [selectedCategory, setSelectedCategory] = useState("Tout");

  const filteredProducts = useMemo(
    () =>
      selectedCategory === "Tout"
        ? products
        : products.filter((product) => product.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020912]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-white">
            <img src="/logo-sds.svg" alt="SDS PRO" className="h-10 w-auto" />
            <span className="hidden md:inline">SDS PRO</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition ${link.active ? "text-cyan-300" : "hover:text-cyan-300"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://wa.me/221770699739"
            target="_blank"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            💬 WhatsApp
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 py-20 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,229,255,0.12),_transparent_50%)] opacity-60" />
        <div className="relative mx-auto max-w-[1400px] rounded-[32px] border border-white/10 bg-[#04101d]/95 p-10 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:p-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_0.7fr] lg:items-center">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                Ordinateurs Premium
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Trouvez <span className="block text-cyan-400">votre PC</span> idéal
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300">
                MacBook, Dell, HP, Lenovo, Asus... Ordinateurs portables neufs et reconditionnés,
                vérifiés et prêts pour Dakar.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#catalogue" className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Voir les ordinateurs
                </a>
                <Link href="https://wa.me/221770699739" target="_blank" className="rounded-2xl border border-cyan-500 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-white/5">
                  Contacter WhatsApp
                </Link>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Sélection rapide</div>
              <p className="mt-6 text-3xl font-black text-white">{filteredProducts.length}</p>
              <p className="mt-2 text-sm text-slate-400">ordinateurs disponibles</p>
              <div className="mt-8 grid gap-3 text-left text-sm text-slate-300">
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Livraison</div>
                  <div className="mt-1 text-sm text-slate-400">Gratuite dans tout Dakar</div>
                </div>
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Paiement</div>
                  <div className="mt-1 text-sm text-slate-400">Wave, Mixx, Djamo, MaxIt</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalogue" className="px-6 pb-24 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">// Catalogue</p>
            <h2 className="text-4xl font-black text-white sm:text-5xl">Nos ordinateurs</h2>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? "border-cyan-400 bg-cyan-500 text-black"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400 hover:bg-white/10"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[32px] border border-white/10 bg-[#04101d]/90 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-cyan-400/30"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800 text-4xl shadow-lg shadow-cyan-500/10">
                  {product.icon}
                </div>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-300">
                      {product.category}
                    </span>
                    <span className="text-right font-black text-cyan-300">{product.price} FCFA</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{product.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{product.description}</p>
                  </div>
                </div>
                <button className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Ajouter au panier
                </button>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="mt-8 rounded-[32px] border border-white/10 bg-[#03101d]/90 p-12 text-center text-slate-400">
              Aucun ordinateur trouvé pour cette catégorie.
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-24 lg:px-12">
        <div className="mx-auto max-w-[1400px] space-y-10">
          <div className="space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">// Avantages</p>
            <h2 className="text-4xl font-black text-white sm:text-5xl">Pourquoi acheter chez nous</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {advantages.map((item) => (
              <div key={item.title} className="rounded-[28px] border border-white/10 bg-[#04101d]/90 p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,0.25)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-3xl text-cyan-300">
                  {item.icon}
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-16 text-slate-300 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/logo-sds.svg" alt="SDS PRO" className="h-12 w-auto" />
              <span className="text-lg font-semibold text-white">SDS PRO</span>
            </div>
            <p className="max-w-xl leading-7 text-slate-400">
              Votre boutique d'ordinateurs premium à Dakar. MacBook, Dell, HP, Asus et matériel PC de qualité.
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">NINEA : 013038395 | RCCM : SN DKR 2026 A 16899</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Catalogue</h3>
            <div className="space-y-3 text-sm">
              <Link href="/" className="block transition hover:text-cyan-300">Smartphones</Link>
              <Link href="/accessoires" className="block transition hover:text-cyan-300">Accessoires</Link>
              <Link href="/ordinateurs" className="block transition hover:text-cyan-300">Ordinateurs</Link>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Contact</h3>
            <div className="space-y-3 text-sm">
              <a href="tel:+221770699739" className="block transition hover:text-cyan-300">77 069 97 39</a>
              <a href="https://wa.me/221770699739" className="block transition hover:text-cyan-300">WhatsApp</a>
              <a href="https://www.facebook.com/share/1LQKP4saFs/" className="block transition hover:text-cyan-300">Facebook</a>
              <a href="https://www.instagram.com/seckdigitalservicepro1" className="block transition hover:text-cyan-300">Instagram</a>
              <a href="mailto:contact@sdsprotech.com" className="block transition hover:text-cyan-300">Email</a>
              <a href="#" className="block transition hover:text-cyan-300">Petit Mbao, Dakar</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProduitPage() {
  const navLinks = [
    { href: "/", label: "Smartphones" },
    { href: "/accessoires", label: "🎧 Accessoires" },
    { href: "/ordinateurs", label: "💻 Ordinateurs" },
    { href: "/produit", label: "Produit", active: true },
  ];

  const gallerySlides = [
    {
      title: "Smartphone premium",
      caption: "Écran AMOLED, processeur puissant et finition luxe.",
      color: "from-slate-900 via-slate-800 to-cyan-500",
    },
    {
      title: "Caméra 108MP",
      caption: "Photos nettes, zoom hybride et modes nuit avancés.",
      color: "from-slate-900 via-slate-700 to-blue-500",
    },
    {
      title: "Autonomie renforcée",
      caption: "Batterie longue durée avec charge rapide 65W.",
      color: "from-slate-900 via-slate-700 to-emerald-500",
    },
  ];

  const specs = [
    "Écran 6.7\" Super Retina XDR",
    "Processeur A18 / Snapdragon 8 Gen 3",
    "12 Go RAM - 256 Go stockage",
    "Recharge rapide 65W",
    "5G / Wi-Fi 6E / Bluetooth 5.3",
  ];

  const paymentOptions = [
    { label: "Wave", icon: "📱" },
    { label: "Mixx", icon: "💧" },
    { label: "Djamo", icon: "💳" },
    { label: "MaxIt", icon: "🟢" },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const slide = gallerySlides[activeSlide];

  const totalPrice = useMemo(() => {
    const base = 249900;
    return new Intl.NumberFormat("fr-FR").format(base * quantity);
  }, [quantity]);

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020912]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-white">
            <img src="/logo-sds.svg" alt="SDS PRO" className="h-10 w-auto" />
            <span className="hidden md:inline">SDS PRO</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition ${link.active ? "text-cyan-300" : "hover:text-cyan-300"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://wa.me/221770699739"
            target="_blank"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            💬 WhatsApp
          </Link>
        </div>
      </header>

      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[0.9fr_0.7fr] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              Fiche produit
            </p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Découvrez <span className="block text-cyan-400">notre produit phare</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              Une fiche produit claire et moderne pour votre boutique. Caractéristiques, galerie,
              prix et achat rapide, avec support complet à Dakar.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#details" className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                Voir les détails
              </a>
              <Link href="https://wa.me/221770699739" target="_blank" className="rounded-2xl border border-cyan-500 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-white/5">
                Contacter WhatsApp
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
            <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Produit</div>
            <div className="mt-6 space-y-4">
              <div className="text-3xl font-black text-white">249 900 FCFA</div>
              <div className="grid gap-3 text-sm text-slate-300">
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Livraison</div>
                  <div className="mt-1 text-sm text-slate-400">24-48h à Dakar</div>
                </div>
                <div className="rounded-3xl bg-[#02101f]/80 p-4">
                  <div className="font-semibold text-white">Paiement</div>
                  <div className="mt-1 text-sm text-slate-400">Wave · Mixx · Djamo · MaxIt</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="details" className="border-t border-white/10 px-6 pb-24 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[0.8fr_0.7fr]">
          <div className="space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%)]" />
                <div className="relative grid gap-6">
                  <div className="h-[420px] overflow-hidden rounded-[28px] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
                    <div className="h-full w-full rounded-[28px] bg-gradient-to-br shadow-inner shadow-cyan-500/20">
                      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center text-white">
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-3xl font-black text-cyan-300">
                          {slide.title}
                        </div>
                        <p className="max-w-xl text-base leading-7 text-slate-300">{slide.caption}</p>
                        <div className="grid w-full grid-cols-3 gap-4">
                          {gallerySlides.map((item, index) => (
                            <button
                              key={item.title}
                              type="button"
                              onClick={() => setActiveSlide(index)}
                              className={`rounded-3xl border p-3 text-sm transition ${
                                activeSlide === index
                                  ? "border-cyan-400 bg-cyan-500/10 text-white"
                                  : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400"
                              }`}
                            >
                              {item.title.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-[#04101d]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
                <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Spécifications</div>
                <ul className="mt-5 space-y-3 text-sm text-slate-300">
                  {specs.map((spec) => (
                    <li key={spec} className="rounded-2xl bg-white/5 px-4 py-3">{spec}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-[#04101d]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
                <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Paiement</div>
                <div className="mt-5 grid gap-3 text-sm text-slate-300">
                  {paymentOptions.map((option) => (
                    <div key={option.label} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-lg text-cyan-300">
                        {option.icon}
                      </span>
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-3xl bg-[#02101f]/80 p-5 text-sm text-slate-300">
                  <p className="font-semibold text-white">Quantité</p>
                  <div className="mt-4 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((count) => Math.max(1, count - 1))}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-lg text-cyan-300 transition hover:bg-white/10"
                    >
                      −
                    </button>
                    <span className="min-w-[48px] text-center text-lg font-bold text-white">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((count) => count + 1)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-lg text-cyan-300 transition hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-5 rounded-3xl bg-[#02101f]/80 px-4 py-4 text-white">
                    Total estimé
                    <div className="mt-2 text-2xl font-black text-cyan-300">{totalPrice} FCFA</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Résumé</p>
                  <h2 className="mt-3 text-3xl font-black text-white">SDS PRO Edition</h2>
                </div>
                <span className="rounded-3xl bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300">Top vente</span>
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-300">
                Une fiche produit moderne et complète qui met en valeur votre appareil, facilite la
                décision d'achat et renforce la confiance du client.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <button className="rounded-3xl bg-cyan-500 px-5 py-4 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Ajouter au panier
                </button>
                <Link
                  href="https://wa.me/221770699739"
                  target="_blank"
                  className="rounded-3xl border border-white/10 px-5 py-4 text-sm font-semibold text-cyan-300 transition hover:bg-white/5 text-center"
                >
                  Commander via WhatsApp
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Support</p>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="rounded-3xl bg-white/5 px-4 py-4">
                  <p className="font-semibold text-white">Livraison</p>
                  <p className="mt-2 text-slate-400">Gratuite à Dakar en 24-48h.</p>
                </div>
                <div className="rounded-3xl bg-white/5 px-4 py-4">
                  <p className="font-semibold text-white">Paiement sécurisé</p>
                  <p className="mt-2 text-slate-400">Wave, Mixx, Djamo et MaxIt disponibles.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-16 text-slate-300 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/logo-sds.svg" alt="SDS PRO" className="h-12 w-auto" />
              <span className="text-lg font-semibold text-white">SDS PRO</span>
            </div>
            <p className="max-w-xl leading-7 text-slate-400">
              Votre boutique d'ordinateurs premium à Dakar. MacBook, Dell, HP, Asus et matériel PC de qualité.
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">NINEA : 013038395 | RCCM : SN DKR 2026 A 16899</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Catalogue</h3>
            <div className="space-y-3 text-sm">
              <Link href="/" className="block transition hover:text-cyan-300">Smartphones</Link>
              <Link href="/accessoires" className="block transition hover:text-cyan-300">Accessoires</Link>
              <Link href="/ordinateurs" className="block transition hover:text-cyan-300">Ordinateurs</Link>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/70">Contact</h3>
            <div className="space-y-3 text-sm">
              <a href="tel:+221770699739" className="block transition hover:text-cyan-300">77 069 97 39</a>
              <a href="https://wa.me/221770699739" className="block transition hover:text-cyan-300">WhatsApp</a>
              <a href="https://www.facebook.com/share/1LQKP4saFs/" className="block transition hover:text-cyan-300">Facebook</a>
              <a href="https://www.instagram.com/seckdigitalservicepro1" className="block transition hover:text-cyan-300">Instagram</a>
              <a href="mailto:contact@sdsprotech.com" className="block transition hover:text-cyan-300">Email</a>
              <a href="#" className="block transition hover:text-cyan-300">Petit Mbao, Dakar</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CreditHalalPage() {
  const SUPA_URL = "https://fvfkawxwtsziqzibzbxt.supabase.co";
  const SUPA_KEY = "sb_publishable_BTBvJ0drkx8ZWflBG7IhMA_A_b6h7rI";
  const FRAIS_MDM = 10000;

  const sampleProducts = [
    { id: 1, nom: "iPhone 15 Pro", prix: 299900, emoji: "📱" },
    { id: 2, nom: "Samsung Galaxy S24", prix: 249900, emoji: "📱" },
    { id: 3, nom: "Infinix Zero X", prix: 139900, emoji: "📱" },
  ];

  const principles = [
    { icon: "🚫", title: "Sans Intérêt", description: "Vous payez exactement le prix du téléphone, rien de plus." },
    { icon: "🛡️", title: "Sécurisé MDM", description: "Appareil géré jusqu'au dernier paiement." },
    { icon: "📋", title: "Transparent", description: "Tous les frais affichés clairement dès le départ." },
    { icon: "✅", title: "Halal Certifié", description: "Contrat Murabaha conforme à la charia." },
  ];

  const steps = [
    { title: "Créez votre compte", description: "Inscrivez-vous sur SDS PRO avec votre vrai nom et numéro de téléphone." },
    { title: "Soumettez votre dossier", description: "Envoyez vos documents d'identité clairs et lisibles." },
    { title: "Validation sous 24-48h", description: "Notre équipe vérifie votre dossier et vous notifie sur WhatsApp." },
    { title: "Payez l'acompte + MDM", description: "50% du prix + 10 000 FCFA de frais MDM." },
    { title: "Recevez votre téléphone", description: "Livraison sous 24-48h à Dakar." },
    { title: "Dernier versement", description: "Après le 3ème paiement, l'appareil vous appartient totalement." },
  ];

  const requiredFiles = [
    { key: "file1", label: "CNI Recto", emoji: "🪪", hint: "Appuyer pour prendre une photo ou choisir" },
    { key: "file2", label: "CNI Verso", emoji: "🪪", hint: "Face arrière de la CNI" },
    { key: "file3", label: "Selfie avec CNI", emoji: "🤳", hint: "Votre visage + CNI visible" },
    { key: "file4", label: "CNI Légalisée", emoji: "📜", hint: "Copie légalisée par autorité compétente" },
    { key: "file5", label: "Certificat de résidence", emoji: "🏠", hint: "Document récent à votre nom" },
  ];

  const docItems = [
    { icon: "🪪", title: "CNI Recto / Verso", note: "PHOTO CLAIRE · LES 2 FACES" },
    { icon: "🤳", title: "Selfie avec votre CNI", note: "VISAGE + CNI VISIBLE SUR LA MÊME PHOTO" },
    { icon: "📜", title: "Copie CNI légalisée", note: "LÉGALISÉE PAR UNE AUTORITÉ COMPÉTENTE" },
    { icon: "🏠", title: "Certificat de résidence", note: "NOM CORRESPONDANT AU COMPTE · DATE RÉCENTE" },
  ];

  const [products, setProducts] = useState(sampleProducts);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState({ nom: "", tel: "", adresse: "", email: "" });
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${SUPA_URL}/rest/v1/products?visible=eq.true&select=id,nom,prix,emoji`, {
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
          },
        });
        if (!response.ok) throw new Error("Impossible de charger les produits");
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((item: any) => ({
            id: Number(item.id),
            nom: item.nom || "Produit",
            prix: Number(item.prix) || 0,
            emoji: item.emoji || "📱",
          }));
          setProducts(formatted);
        }
      } catch (error) {
        console.warn(error);
      }
    }

    loadProducts();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const price = selectedProduct ? selectedProduct.prix : 0;
  const acompte = Math.ceil(price * 0.5);
  const reste = price - acompte;
  const mensualite = Math.ceil(reste / 2);
  const totalAujourdhui = selectedProduct ? acompte + FRAIS_MDM : 0;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";

  const updateField = (field: string, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleFileChange = (key: string, file?: File) => {
    if (!file) return;
    setFilePreviews((current) => ({ ...current, [key]: file.name }));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 3000);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      showToast("❌ Choisissez un produit.");
      return;
    }
    if (!formValues.nom || !formValues.tel || !formValues.adresse) {
      showToast("❌ Remplissez les champs obligatoires.");
      return;
    }
    if (requiredFiles.some((file) => !filePreviews[file.key])) {
      showToast("❌ Téléversez tous les documents requis.");
      return;
    }

    setIsSubmitting(true);
    showToast("✅ Formulaire prêt, fonctionnalité backend non activée dans cette version.");
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020912]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="text-sm font-semibold text-cyan-300 hover:text-cyan-100">
            ← Retour à la boutique
          </Link>
          <Link href="/" className="text-lg font-black tracking-[0.2em] text-white">
            SDS
          </Link>
          <div className="text-right text-xs text-slate-400">Connectez-vous pour soumettre votre dossier</div>
        </div>
      </header>

      <div className="pt-24">
        <section className="bg-[radial-gradient(circle_at_top,_rgba(0,200,255,0.12),_transparent_55%)] px-6 pb-20 pt-10 lg:px-12">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 px-8 py-10 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
              <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-amber-300">
                🌙 VENTE MOURABAHA · SANS INTÉRÊT · PAIEMENT ÉCHELONNÉ
              </div>
              <div className="mt-8 space-y-6 text-center">
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Achat <span className="text-amber-300">Échelonné</span> <span className="text-cyan-300">Halal</span>
                </h1>
                <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300">
                  Obtenez votre smartphone avec un acompte de 50% + 2 versements. Payez le prix exact du téléphone, sans frais cachés.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {principles.map((item) => (
                  <div key={item.title} className="rounded-[20px] border border-white/10 bg-amber-400/5 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl text-amber-300">
                      {item.icon}
                    </div>
                    <div className="mt-4 font-semibold text-white">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 lg:px-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_0.75fr]">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">💰 Simuler votre crédit</div>
              <div className="mt-6 space-y-6">
                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-300">Choisir un produit</label>
                  <select
                    value={selectedProductId ?? ""}
                    onChange={(event) => setSelectedProductId(Number(event.target.value) || null)}
                    className="w-full rounded-2xl border border-white/10 bg-[#020912] px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">— Choisir un produit —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.emoji} {product.nom} — {formatPrice(product.prix)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct && (
                  <div className="rounded-3xl border border-white/10 bg-[#020912]/95 p-5">
                    <div className="flex items-center gap-4 rounded-3xl bg-[#02101f]/80 p-4">
                      <div className="text-3xl">{selectedProduct.emoji}</div>
                      <div>
                        <div className="font-semibold text-white">{selectedProduct.nom}</div>
                        <div className="text-sm text-slate-400">{formatPrice(selectedProduct.prix)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 rounded-3xl border border-white/10 bg-[#020912]/95 p-6">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Prix total</span>
                    <span>{selectedProduct ? formatPrice(price) : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>🔑 Acompte (50%)</span>
                    <span className="text-amber-300">{selectedProduct ? formatPrice(acompte) : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>📅 Mensualité × 3</span>
                    <span>{selectedProduct ? formatPrice(mensualite) + " × 2" : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>🔒 Frais MDM</span>
                    <span className="text-emerald-300">{formatPrice(FRAIS_MDM)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 font-semibold text-white">
                    <span>💳 Total à payer aujourd'hui</span>
                    <span>{selectedProduct ? formatPrice(totalAujourdhui) : "—"}</span>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="rounded-3xl border border-emerald-400/10 bg-emerald-500/5 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Exemple :</p>
                    <p>
                      Vous payez <strong className="text-white">{formatPrice(acompte)}</strong> aujourd'hui + les frais MDM de 10 000 FCFA, puis <strong className="text-white">{formatPrice(mensualite)}</strong> × 2 versements. <strong className="text-emerald-300">Aucun intérêt.</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
                <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">📋 Comment ça marche</div>
                <div className="mt-6 space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.title} className="flex gap-4 rounded-3xl border border-white/10 bg-[#020912]/90 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-500 text-lg font-bold text-black">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{step.title}</div>
                        <div className="text-sm text-slate-400">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
                <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">📁 Documents requis</div>
                <div className="mt-6 grid gap-4">
                  {docItems.map((item) => (
                    <div key={item.title} className="rounded-[24px] border border-white/10 bg-[#020912]/80 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="font-semibold text-white">{item.title}</div>
                          <div className="text-sm text-slate-400">{item.note}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 lg:px-12">
          <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-[0.8fr_0.7fr]">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Remplissez votre dossier</div>
              <div className="mt-6 space-y-6">
                <div className="grid gap-4">
                  <label className="space-y-2 text-sm text-slate-300">
                    Nom complet
                    <input
                      value={formValues.nom}
                      onChange={(event) => updateField("nom", event.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="Nom complet"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Téléphone
                    <input
                      value={formValues.tel}
                      onChange={(event) => updateField("tel", event.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="77 000 00 00"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Adresse
                    <input
                      value={formValues.adresse}
                      onChange={(event) => updateField("adresse", event.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="Dakar, Sénégal"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Email
                    <input
                      value={formValues.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-[#020912] px-4 py-3 text-white outline-none focus:border-cyan-400"
                      placeholder="vous@exemple.com"
                      type="email"
                    />
                  </label>
                </div>

                <div className="grid gap-4">
                  {requiredFiles.map((file) => (
                    <label key={file.key} className="rounded-3xl border border-white/10 bg-[#020912]/90 p-4 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-4">
                        <span>{file.emoji} {file.label}</span>
                        <span className="text-xs text-slate-400">{filePreviews[file.key] || file.hint}</span>
                      </div>
                      <input
                        type="file"
                        className="mt-3 w-full text-sm text-slate-400"
                        onChange={(event) => handleFileChange(file.key, event.target.files?.[0])}
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-3xl bg-cyan-500 px-6 py-4 text-sm font-semibold text-black transition hover:bg-cyan-400"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Envoi…" : "Soumettre ma demande"}
                </button>
                {toastMessage && <div className="rounded-3xl bg-white/5 px-4 py-3 text-sm text-slate-100">{toastMessage}</div>}
              </div>
            </div>

            <aside className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Documents essentiels</div>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                {docItems.map((item) => (
                  <div key={item.title} className="rounded-3xl bg-[#020912]/80 p-4">
                    <div className="font-semibold text-white">{item.icon} {item.title}</div>
                    <div className="mt-2 text-slate-400">{item.note}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function MonCreditPage() {
  const progressSteps = [
    { label: "Acompte", status: "Payé" },
    { label: "Versement 1", status: "À venir" },
    { label: "Versement 2", status: "À venir" },
    { label: "Crédit soldé", status: "Non" },
  ];

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020912]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="text-sm font-semibold text-cyan-300 hover:text-cyan-100">
            SDS
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/credit-halal" className="hover:text-cyan-300">
              Achat Échelonné
            </Link>
            <Link href="/" className="hover:text-cyan-300">
              Accueil
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-[#04101d]/95 p-10 shadow-[0_35px_120px_rgba(0,0,0,0.45)] lg:p-16">
          <div className="space-y-6 text-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-5 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              💳 Espace Crédit
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Mon <span className="text-cyan-300">Crédit</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300">
              Suivez vos versements, consultez l'état de votre dossier et payez facilement vos échéances SDS PRO.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Votre dossier</div>
              <div className="mt-8 space-y-4">
                <div className="rounded-[28px] bg-[#020912]/80 p-6">
                  <div className="text-sm text-slate-400">Produit</div>
                  <div className="mt-3 text-3xl font-black text-white">iPhone 15 Pro</div>
                  <div className="mt-2 text-sm text-slate-500">Dossier #CRD-2026-0917</div>
                </div>
                <div className="rounded-[28px] bg-[#020912]/80 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Montant payé</div>
                      <div className="mt-2 text-3xl font-black text-cyan-300">149 900 FCFA</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Avancement</div>
                      <div className="mt-2 text-3xl font-black text-white">50%</div>
                    </div>
                  </div>
                  <div className="mt-5 rounded-full bg-white/5 p-1">
                    <div className="h-2 w-1/2 rounded-full bg-cyan-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Versements</div>
              <div className="mt-8 space-y-4">
                {progressSteps.map((step) => (
                  <div key={step.label} className="rounded-[24px] border border-white/10 bg-[#020912]/90 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-white">{step.label}</div>
                        <div className="text-sm text-slate-500">Échéance prévue</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        step.status === "Payé"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-cyan-500/10 text-cyan-300"
                      }`}>
                        {step.status}
                      </span>
                    </div>
                    {step.status !== "Payé" && (
                      <button className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                        💳 Payer {step.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Informations</div>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <p>Lorsque votre dossier est validé, les versements sont affichés ici avec les boutons de paiement.</p>
                <p>En cas de retard, certaines fonctionnalités de l'appareil peuvent être restreintes.</p>
                <p>Appelez le support : <a href="tel:+221770699739" className="text-cyan-300 underline">77 069 97 39</a></p>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Crédit soldé</div>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <p>Une fois tous les versements réglés, votre téléphone est libéré définitivement.</p>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
                >
                  Supprimer mes documents
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-12 text-center text-sm text-slate-500 lg:px-12">
        SDS PRO · Mon Crédit · NINEA 013038395 · RCCM SN.DKR.2026.A.16899 · Dakar
      </footer>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-10">
          <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <h2 className="text-2xl font-black text-amber-300">Supprimer mes documents</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Cette action est définitive. Vos documents seront supprimés de nos serveurs après traitement.
            </p>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <p>• Après suppression, vous devrez fournir à nouveau vos documents pour une nouvelle demande.</p>
              <p>• Cette opération est irréversible.</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SalleVisionnagePage() {
  const EPISODES = [
    {
      id: "v1",
      n: 1,
      title: "Bienvenue + L'essence du trading",
      dur: "9 min",
      desc: "Le trading expliqué comme un commerce. Les cinq familles d'actifs et la loi de l'offre et de la demande.",
    },
    {
      id: "v2",
      n: 2,
      title: "Les actions décryptées",
      dur: "10 min",
      desc: "Ce qu'est vraiment une action, pourquoi les entreprises en vendent, et ce qui fait monter ou baisser les prix.",
    },
    {
      id: "v3",
      n: 3,
      title: "Se protéger : risque et propriété réelle",
      dur: "9 min",
      desc: "La faillite, la diversification, et la différence vitale entre posséder une action et parier sur son prix.",
    },
    {
      id: "v4",
      n: 4,
      title: "Choisir son courtier et sécuriser ses fonds",
      dur: "8 min",
      desc: "Courtier régulé, ségrégation des titres, et ce qui se passe vraiment si votre broker fait faillite.",
    },
    {
      id: "v5",
      n: 5,
      title: "L'état d'esprit du trader + conclusion",
      dur: "7 min",
      desc: "Patience, discipline, gestion du risque : les principes qui font durer un investisseur.",
    },
  ];

  const initialVideoMeta = {
    title: "—",
    dur: "—",
    desc: "",
  };

  type Message = { type: "err" | "ok"; text: string };
  type GateMode = "auth" | "pay";

  const [isLoading, setIsLoading] = useState(true);
  const [gateVisible, setGateVisible] = useState(true);
  const [gateMode, setGateMode] = useState<GateMode>("auth");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMsg, setAuthMsg] = useState<Message | null>(null);
  const [payMsg, setPayMsg] = useState<Message | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [shieldOn, setShieldOn] = useState(false);
  const [videoMeta, setVideoMeta] = useState(initialVideoMeta);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsLoading(false), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const video = videoRef.current;
      if (document.hidden) {
        if (video && !video.paused) {
          video.dataset.autoresume = "true";
          video.pause();
        }
        setShieldOn(true);
      } else {
        setShieldOn(false);
        if (video?.dataset.autoresume === "true") {
          video.dataset.autoresume = "";
          video.play().catch(() => undefined);
        }
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!gateVisible && hasAccess && !activeEpisodeId) {
      playEpisode(EPISODES[0]);
    }
  }, [gateVisible, hasAccess, activeEpisodeId]);

  const completedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress],
  );

  const progressText = `${completedCount} / ${EPISODES.length} terminé`;

  const toggleAuthMode = () => {
    setAuthMode(authMode === "login" ? "signup" : "login");
    setAuthMsg(null);
    setPayMsg(null);
  };

  const handleAuth = async () => {
    setAuthMsg(null);
    if (!userEmail.trim()) {
      setAuthMsg({ type: "err", text: "Renseignez votre e-mail." });
      return;
    }
    setAuthLoading(true);
    window.setTimeout(() => {
      setAuthLoading(false);
      setUserId(userEmail);
      setGateMode("pay");
      setAuthMsg({
        type: "ok",
        text:
          authMode === "login"
            ? "Connexion simulée. Payer pour accéder à la salle."
            : "Compte créé. Payer pour débloquer l'accès.",
      });
    }, 800);
  };

  const handlePay = async () => {
    setPayMsg(null);
    if (!userId) {
      setPayMsg({ type: "err", text: "Connectez-vous d'abord pour payer." });
      return;
    }
    setPayLoading(true);
    window.setTimeout(() => {
      setPayLoading(false);
      setHasAccess(true);
      setGateVisible(false);
      setPayMsg({ type: "ok", text: "Paiement simulé — accès accordé." });
    }, 900);
  };

  const handleLogout = () => {
    setGateVisible(true);
    setGateMode("auth");
    setAuthMode("login");
    setAuthMsg(null);
    setPayMsg(null);
    setAuthLoading(false);
    setPayLoading(false);
    setHasAccess(false);
    setUserEmail("");
    setUserId("");
    setActiveEpisodeId(null);
    setVideoMeta(initialVideoMeta);
    setProgress({});
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
  };

  const isEpisodeUnlocked = (episode: typeof EPISODES[number]) => {
    if (!hasAccess) return false;
    if (episode.n <= 1) return true;
    const previous = EPISODES[episode.n - 2];
    return !!progress[previous.id];
  };

  const markEpisodeComplete = (episodeId: string) => {
    setProgress((prev) => ({ ...prev, [episodeId]: true }));
  };

  const playEpisode = (episode: typeof EPISODES[number]) => {
    if (!hasAccess) return;
    if (!isEpisodeUnlocked(episode)) {
      setAuthMsg({
        type: "err",
        text: `🔒 Terminez d'abord le module ${episode.n - 1} pour débloquer celui-ci.`,
      });
      return;
    }
    setActiveEpisodeId(episode.id);
    setVideoMeta({ title: episode.title, dur: episode.dur, desc: episode.desc });
    if (videoRef.current) {
      videoRef.current.src = "";
      videoRef.current.play().catch(() => undefined);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activeEpisodeId || !video.duration) return;
    if (!progress[activeEpisodeId] && video.currentTime / video.duration >= 0.9) {
      markEpisodeComplete(activeEpisodeId);
    }
  };

  const handleEnded = () => {
    if (!activeEpisodeId) return;
    markEpisodeComplete(activeEpisodeId);
    const current = EPISODES.find((ep) => ep.id === activeEpisodeId);
    if (!current) return;
    const next = EPISODES[current.n];
    if (next && isEpisodeUnlocked(next)) {
      playEpisode(next);
    }
  };

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark">S</div>
          <div>
            SDS ProTech
            <small>Salle de visionnage</small>
          </div>
        </div>
        <div className="spacer" />
        <div className="user-chip">
          <span>👤</span>
          <b>{userEmail || "—"}</b>
        </div>
        <button className="btn btn-ghost" type="button" onClick={handleLogout}>
          Quitter
        </button>
      </header>

      <div className="wrap">
        <div className="grid">
          <main>
            <div className="stage">
              <video
                ref={videoRef}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                preload="metadata"
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
              />
              <div className="wm" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, index) => (
                  <span key={index} style={{ opacity: 0 }} />
                ))}
              </div>
              <div className={`shield${shieldOn ? " on" : ""}`}>
                <div className="ic">⏸</div>
                <h3>Lecture en pause</h3>
                <p>
                  La vidéo se met en pause quand vous quittez cette fenêtre, pour protéger le contenu.
                  Revenez ici pour continuer.
                </p>
              </div>
            </div>

            <h1 className="nowtitle">{videoMeta.title}</h1>
            <div className="nowmeta">
              <span className="pill">Module {activeEpisodeId ? EPISODES.find((ep) => ep.id === activeEpisodeId)?.n : 1}</span>
              <span>{videoMeta.dur}</span>
            </div>
            <p className="desc">{videoMeta.desc || "Connectez-vous et débloquez l'accès pour démarrer la formation."}</p>
            <p className="footnote">
              Contenu protégé © SDS ProTech. Cette session est associée à votre compte et tracée par filigrane.
              La revente, le partage ou l'enregistrement de ces vidéos sont interdits.
            </p>
          </main>

          <aside className="side">
            <h2>Programme</h2>
            <div className="prog">{progressText}</div>
            <div id="epList">
              {EPISODES.map((episode) => {
                const unlocked = isEpisodeUnlocked(episode);
                const done = !!progress[episode.id];
                return (
                  <button
                    key={episode.id}
                    type="button"
                    className={`ep${activeEpisodeId === episode.id ? " active" : ""}${unlocked ? "" : " locked"}`}
                    onClick={() => playEpisode(episode)}
                    disabled={!unlocked}
                  >
                    <div className="thumb">
                      {episode.n}
                      <div className="lock">🔒</div>
                    </div>
                    <div className="meta">
                      <b>{episode.title}</b>
                      <span>Module {episode.n} · {episode.dur}</span>
                    </div>
                    <div className="done">✓</div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {gateVisible && (
        <div className={`gate${gateVisible ? "" : " hidden"}`}>
          <div className={`card${gateMode === "pay" ? " paywall" : ""}`}>
            <div className="logo-mark">S</div>
            {gateMode === "auth" ? (
              <>
                <h1 id="authTitle">{authMode === "login" ? "Accéder à la salle" : "Créer votre compte"}</h1>
                <p className="sub" id="authSub">
                  {authMode === "login"
                    ? "Connecte-toi pour reprendre ta formation là où tu t'es arrêté."
                    : "Quelques secondes suffisent. Vous garderez l'accès à vie après achat."}
                </p>
                <div className="field">
                  <label htmlFor="email">Adresse e-mail</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={userEmail}
                    onChange={(event) => setUserEmail(event.target.value)}
                    placeholder="toi@exemple.com"
                  />
                </div>
                <div className="field">
                  <label htmlFor="pass">Mot de passe</label>
                  <input id="pass" type="password" autoComplete="current-password" placeholder="••••••••" />
                </div>
                <div className={`msg${authMsg ? ` ${authMsg.type}` : ""}`}>
                  {authMsg?.text}
                </div>
                <button className="btn btn-cyan" type="button" onClick={handleAuth} disabled={authLoading}>
                  {authLoading ? "Un instant…" : authMode === "login" ? "Se connecter" : "Créer le compte"}
                </button>
                <div className="switch" onClick={toggleAuthMode}>
                  {authMode === "login" ? (
                    <>Pas encore de compte ? <a>Créer un compte</a></>
                  ) : (
                    <>Déjà inscrit ? <a>Se connecter</a></>
                  )}
                </div>
              </>
            ) : (
              <>
                <h1>Les Fondements du Trading</h1>
                <p className="sub">
                  De zéro à la maîtrise — 5 modules vidéo par Souleymane Seck.
                </p>
                <div className="price">
                  15 000 <small>FCFA · accès à vie</small>
                </div>
                <ul className="feat">
                  <li>5 vidéos en haute qualité, à votre rythme</li>
                  <li>Salle de visionnage privée et sécurisée</li>
                  <li>Accès illimité depuis votre téléphone ou ordinateur</li>
                  <li>Paiement Wave, Orange Money, Free Money via PayDunya</li>
                </ul>
                <div className={`msg${payMsg ? ` ${payMsg.type}` : ""}`}>{payMsg?.text}</div>
                <button className="btn btn-cyan" type="button" onClick={handlePay} disabled={payLoading}>
                  {payLoading ? "Ouverture du paiement…" : "Débloquer la formation"}
                </button>
                <div className="switch">
                  <a onClick={() => setGateMode("auth")}>Changer de compte</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        :root {
          --deep: #020912;
          --panel: #0a1422;
          --panel-2: #0f1d31;
          --line: #16273f;
          --blue: #0055ff;
          --cyan: #00c8ff;
          --glow: #00e5ff;
          --ink: #eaf3ff;
          --muted: #7c93b3;
          --danger: #ff4d6d;
          --ok: #23d18b;
          --radius: 18px;
          --shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
          font-synthesis: none;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html,
        body {
          min-height: 100%;
        }

        body {
          background: radial-gradient(1200px 600px at 50% -10%, rgba(0, 85, 255, 0.1), transparent 60%),
            radial-gradient(900px 500px at 90% 110%, rgba(0, 200, 255, 0.06), transparent 55%),
            var(--deep);
          color: var(--ink);
          font-family: var(--font-geist-sans), system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px clamp(16px, 4vw, 40px);
          background: linear-gradient(180deg, rgba(2, 9, 18, 0.92), rgba(2, 9, 18, 0.55) 70%, transparent);
          backdrop-filter: blur(10px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          font-weight: 800;
          letter-spacing: 0.2px;
        }

        .logo-mark {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          flex: none;
          background: conic-gradient(from 200deg, var(--blue), var(--cyan), var(--glow), var(--blue));
          box-shadow: 0 0 18px rgba(0, 200, 255, 0.45);
          display: grid;
          place-items: center;
          color: #01121f;
          font-weight: 900;
          font-size: 15px;
        }

        .brand small {
          display: block;
          font-weight: 500;
          color: var(--muted);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .spacer {
          flex: 1;
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          color: var(--muted);
          padding: 7px 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.02);
        }

        .user-chip b {
          color: var(--ink);
          font-weight: 600;
        }

        .btn {
          cursor: pointer;
          border: none;
          font: inherit;
          font-weight: 700;
          letter-spacing: 0.2px;
          padding: 10px 16px;
          border-radius: 11px;
          transition: 0.18s transform, 0.18s box-shadow, 0.18s background;
        }

        .btn:active {
          transform: translateY(1px);
        }

        .btn-ghost {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--line);
        }

        .btn-cyan {
          background: radial-gradient(circle at top, rgba(0, 200, 255, 0.95), rgba(0, 135, 255, 0.95));
          color: #01121f;
          box-shadow: 0 25px 80px rgba(0, 200, 255, 0.16);
        }

        .wrap {
          padding: 24px;
          max-width: 1300px;
          margin: 0 auto;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.35fr 0.85fr;
          gap: 28px;
        }

        main {
          display: grid;
          gap: 26px;
        }

        .stage {
          position: relative;
          border-radius: 32px;
          background: linear-gradient(180deg, rgba(4, 17, 30, 0.95), rgba(2, 9, 18, 0.9));
          overflow: hidden;
          min-height: 480px;
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.35);
        }

        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .shield {
          pointer-events: none;
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          opacity: 0;
          transform: scale(0.98);
          transition: 0.3s ease;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          text-align: center;
          padding: 28px;
        }

        .shield.on {
          opacity: 1;
          transform: scale(1);
        }

        .shield .ic {
          font-size: 38px;
          margin-bottom: 16px;
        }

        .nowtitle {
          font-size: clamp(2.4rem, 4vw, 3.1rem);
          font-weight: 900;
          color: #fff;
        }

        .nowmeta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: #a3b6d3;
          margin-top: 12px;
        }

        .pill {
          border-radius: 999px;
          background: rgba(0, 200, 255, 0.1);
          padding: 7px 14px;
          font-size: 0.9rem;
          color: #a4f0ff;
        }

        .desc,
        .footnote {
          max-width: 700px;
          line-height: 1.8;
          color: #bbc7dd;
        }

        .footnote {
          opacity: 0.8;
        }

        .side {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .side h2 {
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #7c93b3;
        }

        .prog {
          font-size: 2rem;
          font-weight: 800;
          color: #fff;
          margin-top: 8px;
        }

        #epList {
          display: grid;
          gap: 12px;
        }

        .ep {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 18px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #e8f3ff;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ep:hover {
          border-color: rgba(0, 210, 255, 0.24);
        }

        .ep.locked {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .ep.active {
          border-color: #00d1ff;
          background: rgba(0, 209, 255, 0.08);
        }

        .thumb {
          min-width: 52px;
          min-height: 52px;
          border-radius: 18px;
          background: rgba(0, 210, 255, 0.12);
          display: grid;
          place-items: center;
          position: relative;
          font-weight: 800;
          color: #d0faff;
        }

        .lock {
          position: absolute;
          right: 8px;
          top: 8px;
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .meta b {
          display: block;
          font-size: 1rem;
          margin-bottom: 6px;
        }

        .meta span {
          color: #8fa7c5;
          font-size: 0.9rem;
        }

        .done {
          color: #6ee7b7;
          font-size: 1rem;
          font-weight: 700;
        }

        .gate {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          background: rgba(0, 0, 0, 0.75);
        }

        .card {
          width: min(580px, 100%);
          border-radius: 32px;
          padding: 36px;
          background: rgba(4, 15, 30, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.55);
        }

        .card.paywall {
          background: linear-gradient(180deg, rgba(3, 10, 22, 0.98), rgba(6, 18, 47, 0.98));
        }

        .card h1 {
          font-size: 2.2rem;
          margin-bottom: 14px;
        }

        .sub {
          color: #9bb4d6;
          line-height: 1.8;
          margin-bottom: 26px;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          font-size: 0.9rem;
          color: #9bb4d6;
          margin-bottom: 10px;
        }

        .field input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #eef6ff;
          outline: none;
        }

        .msg {
          min-height: 24px;
          margin-bottom: 20px;
          color: #f8fafc;
        }

        .msg.err {
          color: #fb7185;
        }

        .msg.ok {
          color: #86efac;
        }

        .btn-cyan {
          width: 100%;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: linear-gradient(135deg, #00d1ff, #0ea5e9);
          color: #04111f;
          border: none;
          box-shadow: 0 18px 70px rgba(0, 209, 255, 0.25);
        }

        .switch {
          margin-top: 16px;
          color: #8fa7c5;
          font-size: 0.95rem;
          cursor: pointer;
        }

        .switch a {
          color: #dbeafe;
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}

function VitrineBoutiquePage() {
  const SHOPS: Record<string, { name: string; proprietor: string; city: string; quarter: string; description: string; color: string; logo?: string }> = {
    "sds-pro": {
      name: "SDS PRO",
      proprietor: "Seck Digital Services",
      city: "Dakar",
      quarter: "Plateau",
      description:
        "Boutique officielle SDS PRO. Téléphones premium, paiement mobile sécurisé et livraison rapide.",
      color: "#00c8ff",
    },
    "mbao-electronics": {
      name: "Mbao Electronics",
      proprietor: "Awa Ndoye",
      city: "Dakar",
      quarter: "Mbao",
      description:
        "Boutique partenaire SDS PRO. Téléphones et accessoires haut de gamme avec paiement facilité.",
      color: "#fbbf24",
    },
    "dakar-store": {
      name: "Dakar Store",
      proprietor: "Moussa Diop",
      city: "Dakar",
      quarter: "Yoff",
      description:
        "Revendeur autorisé SDS PRO. Offres spéciales sur les meilleures marques de smartphones.",
      color: "#34d399",
    },
  };

  const searchParams = useSearchParams();
  const [shopSlug, setShopSlug] = useState<string | null>(null);

  useEffect(() => {
    const urlSlug = searchParams.get("boutique");
    if (urlSlug) {
      setShopSlug(urlSlug);
      window.sessionStorage.setItem("sds_boutique", urlSlug);
      return;
    }
    const stored = window.sessionStorage.getItem("sds_boutique");
    if (stored) {
      setShopSlug(stored);
    }
  }, [searchParams]);

  const shop = useMemo(() => {
    if (!shopSlug || !SHOPS[shopSlug]) {
      return SHOPS["sds-pro"];
    }
    return SHOPS[shopSlug];
  }, [shopSlug]);

  const isPartnerShop = shopSlug && shopSlug !== "sds-pro" && SHOPS[shopSlug];

  return (
    <main className="min-h-screen bg-[#0b1220] text-white">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(0,200,255,0.12),_transparent_55%)] pb-16 pt-8">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div
            className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-6 rounded-[20px] border p-6 shadow-[0_18px_80px_rgba(0,0,0,0.35)]"
            style={{
              background: "linear-gradient(150deg, rgba(7,24,40,0.98), rgba(4,15,30,0.95))",
              borderColor: shop.color,
            }}
          >
            <div
              className="sb-logo flex h-16 w-16 items-center justify-center rounded-[16px] border"
              style={{ borderColor: shop.color, background: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-2xl">🏪</span>
            </div>
            <div className="sb-info min-w-0 flex-1">
              <div className="sb-name flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-white">
                {shop.name}
                {isPartnerShop && (
                  <span className="v rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                    Partenaire
                  </span>
                )}
              </div>
              <div className="sb-meta mt-2 text-sm text-slate-400">
                {shop.proprietor} · {shop.city} · {shop.quarter}
              </div>
              <div className="sb-desc mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                {shop.description}
              </div>
            </div>
            <button
              type="button"
              className="sb-switch rounded-[10px] border px-4 py-3 text-sm font-semibold transition hover:border-white/40"
              style={{ borderColor: "rgba(255,255,255,0.14)", color: shop.color }}
              onClick={() => {
                window.sessionStorage.removeItem("sds_boutique");
                window.location.href = "/vitrine-boutique";
              }}
            >
              Changer de boutique
            </button>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-[#04101d]/95 p-10 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">
                Vitrine de boutique
              </div>
              <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">
                {shop.name} présente sa sélection premium.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
                Découvrez les meilleures offres de la boutique partenaire SDS PRO. Chaque produit est
                protégé par notre système de paiement mobile sécurisé et livré rapidement à Dakar.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/" className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                  Retour au catalogue SDS PRO
                </Link>
                <Link href="/espace-partenaire" className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-white/5">
                  Devenir partenaire
                </Link>
              </div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Détails boutique</div>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] bg-[#020912]/70 p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Propriétaire</div>
                  <div className="mt-2 text-lg font-semibold text-white">{shop.proprietor}</div>
                </div>
                <div className="rounded-[24px] bg-[#020912]/70 p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Localisation</div>
                  <div className="mt-2 text-lg font-semibold text-white">{shop.city} · {shop.quarter}</div>
                </div>
                <div className="rounded-[24px] bg-[#020912]/70 p-5">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Couleur d'identité</div>
                  <div className="mt-3 h-8 w-full rounded-2xl" style={{ background: shop.color }} />
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-10 rounded-[28px] border border-white/10 bg-[#04101d]/95 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Comment ça marche</div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { title: "1. Choisissez la boutique", text: "Sélectionnez votre revendeur SDS PRO et découvrez son catalogue filtré." },
                { title: "2. Paiement mobile", text: "Payez facilement via Orange Money, Wave ou Free Money." },
                { title: "3. Livraison rapide", text: "Livraison express à Dakar ou retrait en boutique partenaire." },
              ].map((step) => (
                <div key={step.title} className="rounded-[24px] border border-white/10 bg-[#020912]/80 p-6">
                  <div className="text-sm uppercase tracking-[0.3em] text-slate-400">{step.title}</div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .sb-logo img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </main>
  );
}

function PortailPage() {
  const SHOPS = [
    {
      slug: "mbao-electronics",
      name: "Mbao Electronics",
      proprietor: "Awa Ndoye",
      city: "Dakar",
      quarter: "Mbao",
      phone: "77 123 45 67",
      verified: true,
    },
    {
      slug: "dakar-store",
      name: "Dakar Store",
      proprietor: "Moussa Diop",
      city: "Dakar",
      quarter: "Yoff",
      phone: "77 987 65 43",
      verified: false,
    },
    {
      slug: "sds-pro",
      name: "SDS PRO",
      proprietor: "Seck Digital Services",
      city: "Dakar",
      quarter: "Plateau",
      phone: "77 069 97 39",
      verified: true,
    },
  ];

  function escapeHtml(value: string) {
    return value.replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof SHOPS>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "ready">("idle");

  useEffect(() => {
    const stored = window.sessionStorage.getItem("sds_boutique");
    if (stored) {
      const selected = SHOPS.find((shop) => shop.slug === stored);
      if (selected) {
        setStatus("ready");
        setResults([selected]);
      }
    }
  }, []);

  const handleSearch = () => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      setStatus("empty");
      setResults([]);
      return;
    }
    setStatus("searching");
    window.setTimeout(() => {
      const found = SHOPS.filter((shop) =>
        shop.slug.includes(trimmed) ||
        shop.name.toLowerCase().includes(trimmed) ||
        shop.proprietor.toLowerCase().includes(trimmed) ||
        shop.phone.includes(trimmed),
      );
      setResults(found);
      setStatus(found.length ? "ready" : "empty");
    }, 220);
  };

  const chooseShop = (slug: string) => {
    window.sessionStorage.setItem("sds_boutique", slug);
    window.location.href = `/vitrine-boutique?boutique=${encodeURIComponent(slug)}`;
  };

  const chooseSdsPro = () => {
    window.sessionStorage.removeItem("sds_boutique");
    window.location.href = `/vitrine-boutique?boutique=sds-pro`;
  };

  return (
    <main className="min-h-screen bg-[#020912] text-white">
      <section className="portail relative min-h-screen flex flex-col items-center justify-center px-5 py-10 overflow-hidden">
        <div className="absolute -top-[30%] left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(0,200,255,0.12),_transparent_62%)] pointer-events-none" />

        <img className="relative z-10 mb-5 h-[78px]" src="/logo-sds.svg" alt="SDS" />
        <div className="relative z-10 text-center text-[clamp(18px,4vw,30px)] font-black uppercase tracking-[6px] text-white">
          SECK <span className="text-cyan-400">DIGITAL</span> SERVICES <span className="text-cyan-400">PRO</span>
        </div>
        <div className="relative z-10 mt-3 text-center text-xs uppercase tracking-[3px] text-slate-400">
          Réseau de boutiques partenaires
        </div>

        <div className="relative z-10 mt-10 w-full max-w-[560px] rounded-[22px] border border-white/10 bg-[#071828] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[1px] text-white">
            Trouver ma boutique
          </div>
          <div className="mb-2 text-xs text-slate-400">
            Saisissez l'identifiant que votre revendeur vous a communiqué.
          </div>

          <div className="relative mb-4">
            <input
              className="w-full rounded-[14px] border border-white/10 bg-[#020912] px-4 py-4 pr-14 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Numéro, nom du gérant ou nom de la boutique…"
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-300 text-lg">⌕</span>
          </div>
          <button
            className="w-full rounded-[14px] bg-gradient-to-r from-[#0055ff] to-[#00c8ff] px-5 py-4 text-sm font-semibold text-black transition hover:opacity-95"
            onClick={handleSearch}
          >
            Accéder à ma boutique
          </button>

          <div className="mt-4 text-[10px] uppercase tracking-[1px] text-slate-400">
            Vous pouvez rechercher par : <span className="text-slate-200">numéro de téléphone</span>, <span className="text-slate-200">nom du propriétaire</span>, <span className="text-slate-200">nom de la boutique</span> ou <span className="text-slate-200">code partenaire</span>.
          </div>

          <div className="mt-6">
            {status === "searching" && (
              <div className="rounded-[16px] bg-[#020912]/80 p-5 text-center text-slate-300">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
                Recherche…
              </div>
            )}
            {status === "empty" && (
              <div className="rounded-[16px] bg-[#020912]/80 p-5 text-center text-slate-300">
                Aucune boutique trouvée pour « {escapeHtml(query)} ». Vérifiez l'identifiant auprès de votre revendeur.
              </div>
            )}
            {status === "ready" && results.length > 0 && (
              <div className="space-y-3">
                {results.map((shop) => (
                  <button
                    key={shop.slug}
                    type="button"
                    className="flex w-full items-center gap-4 rounded-[14px] border border-white/10 bg-[#020912]/80 p-4 text-left transition hover:border-cyan-400 hover:bg-[#021021]"
                    onClick={() => chooseShop(shop.slug)}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-cyan-500/10 text-2xl">
                      🏪
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                        {shop.name}
                        {shop.verified && <span className="text-cyan-300">✔</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {shop.city} · {shop.quarter}
                      </div>
                    </div>
                    <div className="text-cyan-300">→</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-8 text-center text-sm text-slate-500">
          <button className="underline text-slate-300" type="button" onClick={chooseSdsPro}>
            Continuer sans revendeur (catalogue SDS PRO)
          </button>
        </div>
      </section>
    </main>
  );
}
