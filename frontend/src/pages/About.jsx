import SectionHeading from "../components/SectionHeading";
import LeafDoodles from "../components/LeafDoodles";

export default function About() {
  return (
    <div className="relative max-w-3xl mx-auto px-6 py-20">
      <LeafDoodles />
      <SectionHeading eyebrow="Our Story" title="Made by Two Sisters, Crafted with Love." />
      <div className="space-y-6 text-plum-light/90 dark:text-cream/90 leading-relaxed">
        <p>
          SubhRa Crafts began the way most beautiful things do — quietly, and out of love. Two sisters, sharing a
          love for color, texture, and making things by hand, started experimenting with resin one afternoon and
          never really stopped.
        </p>
        <p>
          What started as a small hobby on a kitchen table slowly grew into SubhRa Crafts: a home for handcrafted
          resin jewelry and art, each piece poured, shaped, and finished entirely by hand. No two pieces are quite
          the same — a little like the two of us.
        </p>
        <p>
          We believe handmade things carry something machine-made things can't: time, attention, and care. Every
          earring, pendant, and hair clip that leaves our hands has been touched, checked, and packed with that same
          intention — a little piece of art, made just for you.
        </p>
        <p className="font-display text-2xl text-plum dark:text-cream text-center pt-6">With love,<br />The SubhRa Crafts sisters 💜</p>
      </div>
    </div>
  );
}
