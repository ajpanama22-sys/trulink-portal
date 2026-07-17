import { motion } from "framer-motion";

// ===============================================
// Landing Page Trulink Fiber
// Estilo corporativo premium: fondo negro, botones dorados, tipografía blanca
// Mostrar 3 opciones principales:
//   1. Registro Cliente B2B
//   2. Registro Inversor Estratégico
//   3. Acceso con USER + PASS
// Logo centrado (logo.png)
// Botones con bordes redondeados, sombra ligera, hover blanco
// ===============================================
export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
      
      {/* Fondo con brillo (efecto visual costoso) */}
      <div className="absolute w-[500px] h-[500px] bg-yellow-600/20 blur-[120px] rounded-full" />

      {/* Logo */}
      <motion.img 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }}
        src="/images/logo.png" 
        alt="Trulink Fiber Logo" 
        style={{ width: "150px", marginBottom: "20px", position: "relative", zIndex: 10 }} 
      />

      {/* Nombre institucional */}
      <motion.h1 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 0.2 }}
        className="text-4xl font-light text-[#DAA520] mb-12 tracking-widest relative z-10"
      >
        Trulink Fiber LLC
      </motion.h1>

      {/* Botones principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        
        {/* Botón 1: Registro Cliente B2B */}
        <motion.a 
          href="/clientes"
          whileHover={{ scale: 1.05, borderColor: "#ffffff" }}
          whileTap={{ scale: 0.95 }}
          className="border border-[#DAA520]/50 rounded-2xl bg-[#DAA520]/10 backdrop-blur-md p-8 flex items-center justify-center cursor-pointer transition-colors duration-300"
        >
          <span className="text-[#DAA520] font-bold text-lg">Registro Cliente B2B</span>
        </motion.a>

        {/* Botón 2: Registro Inversor Estratégico */}
        <motion.a 
          href="/inversores"
          whileHover={{ scale: 1.05, borderColor: "#ffffff" }}
          whileTap={{ scale: 0.95 }}
          className="border border-[#DAA520]/50 rounded-2xl bg-[#DAA520]/10 backdrop-blur-md p-8 flex items-center justify-center cursor-pointer transition-colors duration-300"
        >
          <span className="text-[#DAA520] font-bold text-lg">Registro Inversor Estratégico</span>
        </motion.a>

        {/* Botón 3: Acceso con USER + PASS */}
        <motion.a 
          href="/login"
          whileHover={{ scale: 1.05, borderColor: "#ffffff" }}
          whileTap={{ scale: 0.95 }}
          className="border border-[#DAA520]/50 rounded-2xl bg-[#DAA520]/10 backdrop-blur-md p-8 flex items-center justify-center cursor-pointer transition-colors duration-300"
        >
          <span className="text-[#DAA520] font-bold text-lg">Acceso con User + Pass</span>
        </motion.a>

      </div>

      {/* Footer institucional */}
      <p style={{ marginTop: "60px", fontSize: "12px", color: "#DAA520", position: "relative", zIndex: 10 }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
      
    </div>
  );
}