import { useIsMobile } from '@/hooks/use-mobile';
import whatsappLogo from '@/assets/whatsapp-logo.png';

const WhatsAppButton = () => {
  const isMobile = useIsMobile();
  
  // N'afficher le bouton que sur mobile
  if (!isMobile) return null;
  
  const phoneNumber = "+33678015732"; // Numéro formaté pour WhatsApp (pas d'espaces)
  const message = "Bonjour, je suis intéressé par la création d'un site web. Pouvez-vous m'envoyer un devis ?";
  const whatsappUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;
  
  const handleWhatsAppClick = () => {
    // Track conversion with Google Ads
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'conversion', {'send_to': 'AW-17622509584/J4W4CKz19KcbEJDQiNNB'});
    }
    window.open(whatsappUrl, '_blank');
  };
  
  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-4 right-4 z-50 hover:scale-110 transition-all duration-300 flex items-center justify-center group bg-white rounded-full p-2 shadow-lg"
      aria-label="Contacter via WhatsApp"
    >
      <img 
        src={whatsappLogo} 
        alt="WhatsApp" 
        className="w-[57px] h-[57px] group-hover:scale-110 transition-transform drop-shadow-sm"
      />
    </button>
  );
};

export default WhatsAppButton;