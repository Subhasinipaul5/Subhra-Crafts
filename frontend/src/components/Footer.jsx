import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/logo.jpeg";
import { INSTAGRAM_URL, buildWhatsAppUrl } from "../config";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-plum text-cream/90 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={logo} alt="SubhRa Crafts" className="w-10 h-10 rounded-full object-cover" />
            <div>
              <div className="brand-title text-xl">SubhRa Crafts</div>
              <div className="text-[10px] tracking-widest text-gold uppercase">Handmade with Love</div>
            </div>
          </div>
          <p className="text-sm text-cream/70 leading-relaxed">{t("footer.tagline")}</p>
        </div>

        <div>
          <h4 className="section-title text-base mb-3 text-gold">{t("footer.quickLinks")}</h4>
          <ul className="space-y-2 text-sm text-cream/80">
            <li><Link to="/" className="hover:text-gold">{t("footer.home")}</Link></li>
            <li><Link to="/shop" className="hover:text-gold">{t("footer.shop")}</Link></li>
            <li><Link to="/about" className="hover:text-gold">{t("footer.about")}</Link></li>
            <li><Link to="/contact" className="hover:text-gold">{t("footer.contact")}</Link></li>
            <li><Link to="/custom-order" className="hover:text-gold">{t("footer.customOrders")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="section-title text-base mb-3 text-gold">{t("footer.customerCare")}</h4>
          <ul className="space-y-2 text-sm text-cream/80">
            <li><Link to="/contact" className="hover:text-gold">{t("footer.shipping")}</Link></li>
            <li><Link to="/contact" className="hover:text-gold">{t("footer.returns")}</Link></li>
            <li><Link to="/track-order" className="hover:text-gold">{t("footer.orderTracking")}</Link></li>
            <li><Link to="/contact" className="hover:text-gold">{t("footer.faqs")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="section-title text-base mb-3 text-gold">{t("footer.followUs")}</h4>
          <ul className="space-y-2 text-sm text-cream/80">
            <li><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-gold">{t("footer.instagram")}</a></li>
            <li><a href={buildWhatsAppUrl()} target="_blank" rel="noreferrer" className="hover:text-gold">{t("footer.whatsapp")}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} SubhRa Crafts. {t("footer.rightsReserved")}
      </div>
    </footer>
  );
}
