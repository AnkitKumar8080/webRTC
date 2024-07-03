import HeroSection from "./components/HeroSection";
import ContextApiProvider from "./context/ContextApi";

export default function App() {
  return (
    <div className="h-screen bg-[#181A1B]">
      <ContextApiProvider>
        <HeroSection />
      </ContextApiProvider>
    </div>
  );
}
