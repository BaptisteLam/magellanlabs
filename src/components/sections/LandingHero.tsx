import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 pt-20">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="container mx-auto px-4 text-center relative z-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Créez votre site web avec l'IA
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Générez un site web professionnel en quelques secondes grâce à l'intelligence artificielle
        </p>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-blue-600 to-cyan-600"
          onClick={() => navigate("/builder")}
        >
          Commencer maintenant
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </section>
  );
};

export default LandingHero;
